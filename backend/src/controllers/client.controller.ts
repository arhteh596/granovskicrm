import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { Client, UpdateClientStatusDTO, TransferClientDTO } from '../types';
import { sendPushToUser } from '../utils/push';

const DEFAULT_CALL_STATUSES = [
    'не дозвон',
    'автоответчик',
    'питон',
    'срез',
    'другой человек',
    'перезвон',
    'передать',
    'взял код'
];

const getAllowedStatuses = async (): Promise<string[]> => {
    try {
        const result = await pool.query('SELECT DISTINCT status_value FROM status_buttons WHERE is_active = true');
        const statuses = result.rows.map((row) => row.status_value).filter(Boolean);
        if (!statuses.length) {
            return DEFAULT_CALL_STATUSES;
        }
        return statuses;
    } catch (error) {
        console.error('[getAllowedStatuses] failed, fallback to defaults', error);
        return DEFAULT_CALL_STATUSES;
    }
};

/**
 * Получить всех клиентов (для администратора)
 * @route GET /api/clients
 * @access Admin only
 */
export const getAllClients = async (req: AuthRequest, res: Response) => {
    const { status, database_id, assigned_to } = req.query;

    let query = 'SELECT * FROM clients WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (status) {
        query += ` AND call_status = $${paramIndex++}`;
        values.push(status);
    }

    if (database_id) {
        query += ` AND database_id = $${paramIndex++}`;
        values.push(database_id);
    }

    if (assigned_to) {
        query += ` AND assigned_to = $${paramIndex++}`;
        values.push(assigned_to);
    }

    query += ' ORDER BY created_at DESC LIMIT 1000';

    const result = await pool.query<Client>(query, values);

    res.json({
        success: true,
        data: result.rows,
        total: result.rows.length
    });
};

/**
 * Получить клиентов текущего менеджера
 * @route GET /api/clients/my
 * @access Manager
 */
export const getMyClients = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { status } = req.query;

    let query = 'SELECT * FROM clients WHERE assigned_to = $1';
    const values: any[] = [userId];

    if (status) {
        query += ' AND call_status = $2';
        values.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query<Client>(query, values);

    res.json({
        success: true,
        data: result.rows,
        total: result.rows.length
    });
};

/**
 * Получить следующего клиента для обзвона
 * @route GET /api/clients/next
 * @access Manager & Admin
 */
export const getNextClient = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    // Используем транзакцию и блокировку строк, чтобы один и тот же клиент не выдавался двум менеджерам
    const db = await pool.connect();
    try {
        await db.query('BEGIN');

        if (isAdmin) {
            // Админ может звонить своим и неназначенным, сразу «захватываем» клиента
            const selectRes = await db.query<{ id: number }>(
                `SELECT id
                 FROM clients
                 WHERE (assigned_to = $1 OR assigned_to IS NULL)
                   AND (call_status IS NULL OR call_status = 'не дозвон')
                     ORDER BY return_priority DESC, created_at ASC
                 FOR UPDATE SKIP LOCKED
                 LIMIT 1`,
                [userId]
            );

            if (selectRes.rows.length === 0) {
                await db.query('ROLLBACK');
                return res.json({ success: true, data: null, message: 'Нет доступных клиентов для обзвона' });
            }

            const claimed = await db.query<Client>(
                `UPDATE clients
                 SET assigned_to = COALESCE(assigned_to, $1), updated_at = NOW()
                 WHERE id = $2 AND (assigned_to IS NULL OR assigned_to = $1)
                 RETURNING *`,
                [userId, selectRes.rows[0].id]
            );

            await db.query('COMMIT');
            return res.json({ success: true, data: claimed.rows[0] });
        }

        // Менеджер - ТОЛЬКО если есть активный фильтр
        const filterCheck = await db.query(
            `SELECT id, database_ids, statuses 
             FROM call_filters 
             WHERE is_active = true 
               AND (user_ids IS NULL OR $1 = ANY(user_ids))
             LIMIT 1`,
            [userId]
        );

        if (filterCheck.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.json({
                success: true,
                data: null,
                message: 'Нет доступных клиентов. Активируйте фильтр для работы.'
            });
        }

        const activeFilter = filterCheck.rows[0];
        const databaseIds: number[] = activeFilter.database_ids;
        const statuses: string[] | null = activeFilter.statuses;

        // Формируем условия запроса согласно фильтру + исключаем уже обработанных текущим менеджером
        const conditions: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (databaseIds && databaseIds.length > 0) {
            conditions.push(`database_id = ANY($${idx}::int[])`);
            values.push(databaseIds);
            idx++;
        }

        if (statuses && statuses.length > 0) {
            const hasNew = statuses.includes('новый');
            const other = statuses.filter((s: string) => s !== 'новый');
            const statusParts: string[] = [];
            if (hasNew) statusParts.push('call_status IS NULL');
            if (other.length > 0) {
                statusParts.push(`call_status = ANY($${idx}::varchar[])`);
                values.push(other);
                idx++;
            }
            if (statusParts.length > 0) conditions.push(`(${statusParts.join(' OR ')})`);
        }

        // Только не назначенные или уже назначенные текущему менеджеру
        conditions.push(`(assigned_to IS NULL OR assigned_to = $${idx})`);
        values.push(userId);
        idx++;

        // Исключаем клиентов, которых данный менеджер уже обзванивал
        conditions.push(`NOT EXISTS (
            SELECT 1 FROM call_history ch
            WHERE ch.client_id = clients.id AND ch.user_id = $${idx}
        )`);
        values.push(userId);
        idx++;

        const selectRes = await db.query<{ id: number }>(
            `SELECT id
             FROM clients
             WHERE ${conditions.join(' AND ')}
                 ORDER BY return_priority DESC, updated_at DESC, created_at ASC
             FOR UPDATE SKIP LOCKED
             LIMIT 1`,
            values
        );

        if (selectRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.json({ success: true, data: null, message: 'Нет доступных клиентов в активном фильтре' });
        }

        const claimed = await db.query<Client>(
            `UPDATE clients
             SET assigned_to = COALESCE(assigned_to, $1), updated_at = NOW()
             WHERE id = $2 AND (assigned_to IS NULL OR assigned_to = $1)
             RETURNING *`,
            [userId, selectRes.rows[0].id]
        );

        await db.query('COMMIT');
        return res.json({ success: true, data: claimed.rows[0] });
    } catch (e) {
        await db.query('ROLLBACK');
        throw e;
    } finally {
        db.release();
    }
};

/**
 * Получить клиента по ID
 * @route GET /api/clients/:id
 * @access Manager (только свои), Admin (все)
 */
export const getClientById = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    let query = 'SELECT * FROM clients WHERE id = $1';
    const values: any[] = [id];

    // Менеджер может видеть только своих клиентов
    if (!isAdmin) {
        query += ' AND assigned_to = $2';
        values.push(userId);
    }

    const result = await pool.query<Client>(query, values);

    if (result.rows.length === 0) {
        throw new AppError('Клиент не найден', 404);
    }

    res.json({
        success: true,
        data: result.rows[0]
    });
};

/**
 * Обновить статус звонка клиента
 * @route PATCH /api/clients/:id/status
 * @access Manager & Admin
 */
export const updateClientStatus = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { call_status, notes }: UpdateClientStatusDTO = req.body;
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    console.log(`[updateClientStatus] Client ID: ${id}, Status: ${call_status}, User ID: ${userId}, Role: ${isAdmin ? 'admin' : 'manager'}`);

    const validStatuses = await getAllowedStatuses();

    if (!call_status || !validStatuses.includes(call_status)) {
        throw new AppError('Некорректный статус звонка', 400);
    }

    // Проверяем, что клиент существует и доступен пользователю
    let clientCheck;
    if (isAdmin) {
        // Админ имеет доступ ко всем клиентам
        clientCheck = await pool.query('SELECT id FROM clients WHERE id = $1', [id]);
    } else {
        // Менеджер может обновлять статус, если:
        // 1. Клиент назначен ему
        // 2. ИЛИ клиент находится в активном фильтре менеджера
        const filterCheck = await pool.query(
            `SELECT cf.id, cf.database_ids 
             FROM call_filters cf
             WHERE cf.is_active = true 
             AND (cf.user_ids IS NULL OR $1 = ANY(cf.user_ids))
             LIMIT 1`,
            [userId]
        );

        if (filterCheck.rows.length > 0) {
            const activeFilter = filterCheck.rows[0];
            const databaseIds = activeFilter.database_ids;

            // Проверяем клиента с учетом фильтра или назначения
            if (databaseIds && databaseIds.length > 0) {
                clientCheck = await pool.query(
                    `SELECT id FROM clients 
                     WHERE id = $1 
                     AND (assigned_to = $2 OR database_id = ANY($3))`,
                    [id, userId, databaseIds]
                );
            } else {
                // Если нет фильтра по базам, проверяем только назначение
                clientCheck = await pool.query(
                    'SELECT id FROM clients WHERE id = $1 AND assigned_to = $2',
                    [id, userId]
                );
            }
        } else {
            // Нет активного фильтра - проверяем только назначение
            clientCheck = await pool.query(
                'SELECT id FROM clients WHERE id = $1 AND assigned_to = $2',
                [id, userId]
            );
        }
    }

    if (clientCheck.rows.length === 0) {
        throw new AppError('Клиент не найден или недоступен для вас', 404);
    }

    console.log(`[updateClientStatus] Client ${id} found, proceeding with update`);

    // Начинаем транзакцию
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Обновляем статус клиента и назначаем менеджеру (если еще не назначен)
        const updateResult = await client.query<Client>(
            `UPDATE clients 
             SET call_status = $1, 
                 assigned_to = COALESCE(assigned_to, $3),
                 updated_at = NOW()
             WHERE id = $2 AND (assigned_to IS NULL OR assigned_to = $3)
             RETURNING *`,
            [call_status, id, userId]
        );

        if (updateResult.rows.length === 0 && !isAdmin) {
            throw new AppError('Клиент уже закреплён за другим менеджером', 409);
        }

        console.log(`[updateClientStatus] Client ${id} updated successfully, new status: ${call_status}`);

        // Добавляем запись в историю звонков
        await client.query(
            `INSERT INTO call_history (client_id, user_id, call_status, notes)
       VALUES ($1, $2, $3, $4)`,
            [id, userId, call_status, notes || null]
        );

        // Если есть заметки, добавляем их
        if (notes) {
            await client.query(
                `INSERT INTO client_notes (client_id, user_id, note_text)
         VALUES ($1, $2, $3)`,
                [id, userId, notes]
            );
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            data: updateResult.rows[0],
            message: 'Статус успешно обновлён'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Получить клиентов по статусу
 * @route GET /api/clients/status/:status
 * @access Manager
 */
export const getClientsByStatus = async (req: AuthRequest, res: Response) => {
    const { status } = req.params;
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    let result;

    if (isAdmin) {
        // Админ видит всех клиентов со статусом или только своих
        result = await pool.query<Client>(
            `SELECT * FROM clients 
             WHERE (assigned_to = $1 OR assigned_to IS NULL) AND call_status = $2
             ORDER BY updated_at DESC`,
            [userId, status]
        );
    } else {
        // Менеджер видит клиентов:
        // 1. Назначенных ему с данным статусом
        // 2. ИЛИ из активного фильтра с данным статусом
        const filterCheck = await pool.query(
            `SELECT cf.id, cf.database_ids 
             FROM call_filters cf
             WHERE cf.is_active = true 
             AND (cf.user_ids IS NULL OR $1 = ANY(cf.user_ids))
             LIMIT 1`,
            [userId]
        );

        if (filterCheck.rows.length > 0) {
            const activeFilter = filterCheck.rows[0];
            const databaseIds = activeFilter.database_ids;

            if (databaseIds && databaseIds.length > 0) {
                result = await pool.query<Client>(
                    `SELECT * FROM clients 
                     WHERE (assigned_to = $1 OR database_id = ANY($3))
                     AND call_status = $2
                     ORDER BY updated_at DESC`,
                    [userId, status, databaseIds]
                );
            } else {
                // Если нет фильтра по базам, показываем только назначенных
                result = await pool.query<Client>(
                    `SELECT * FROM clients 
                     WHERE assigned_to = $1 AND call_status = $2
                     ORDER BY updated_at DESC`,
                    [userId, status]
                );
            }
        } else {
            // Нет активного фильтра - показываем только назначенных
            result = await pool.query<Client>(
                `SELECT * FROM clients 
                 WHERE assigned_to = $1 AND call_status = $2
                 ORDER BY updated_at DESC`,
                [userId, status]
            );
        }
    }

    res.json({
        success: true,
        data: result.rows,
        total: result.rows.length
    });
};

/**
 * Установить перезвон для клиента
 * @route POST /api/clients/:id/callback
 * @access Manager & Admin
 */
export const setClientCallback = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { callback_datetime, callback_notes } = req.body;
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    if (!callback_datetime) {
        throw new AppError('Требуется указать дату и время перезвона', 400);
    }

    // Проверяем, что клиент существует и доступен пользователю
    let clientCheck;
    if (isAdmin) {
        clientCheck = await pool.query('SELECT id FROM clients WHERE id = $1', [id]);
    } else {
        // Менеджер может устанавливать перезвон, если:
        // 1. Клиент назначен ему
        // 2. ИЛИ клиент находится в активном фильтре менеджера
        const filterCheck = await pool.query(
            `SELECT cf.id, cf.database_ids 
             FROM call_filters cf
             WHERE cf.is_active = true 
             AND (cf.user_ids IS NULL OR $1 = ANY(cf.user_ids))
             LIMIT 1`,
            [userId]
        );

        if (filterCheck.rows.length > 0) {
            const activeFilter = filterCheck.rows[0];
            const databaseIds = activeFilter.database_ids;

            // Проверяем клиента с учетом фильтра или назначения
            if (databaseIds && databaseIds.length > 0) {
                clientCheck = await pool.query(
                    `SELECT id FROM clients 
                     WHERE id = $1 
                     AND (assigned_to = $2 OR database_id = ANY($3))`,
                    [id, userId, databaseIds]
                );
            } else {
                // Если нет фильтра по базам, проверяем только назначение
                clientCheck = await pool.query(
                    'SELECT id FROM clients WHERE id = $1 AND assigned_to = $2',
                    [id, userId]
                );
            }
        } else {
            // Нет активного фильтра - проверяем только назначение
            clientCheck = await pool.query(
                'SELECT id FROM clients WHERE id = $1 AND assigned_to = $2',
                [id, userId]
            );
        }
    }

    if (clientCheck.rows.length === 0) {
        throw new AppError('Клиент не найден или не доступен для вас', 404);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Обновляем клиента и назначаем менеджеру (если еще не назначен)
        const updateResult = await client.query<Client>(
            `UPDATE clients 
             SET call_status = 'перезвон', 
                 callback_datetime = $1, 
                 callback_notes = $2,
                 assigned_to = COALESCE(assigned_to, $4),
                 updated_at = NOW()
             WHERE id = $3 AND (assigned_to IS NULL OR assigned_to = $4)
             RETURNING *`,
            [callback_datetime, callback_notes || null, id, userId]
        );

        if (updateResult.rows.length === 0 && !isAdmin) {
            throw new AppError('Клиент уже закреплён за другим менеджером', 409);
        }

        // Добавляем запись в историю
        await client.query(
            `INSERT INTO call_history (client_id, user_id, call_status, notes)
             VALUES ($1, $2, 'перезвон', $3)`,
            [id, userId, callback_notes || 'Назначен перезвон']
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            data: updateResult.rows[0],
            message: 'Перезвон успешно назначен'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Передать клиента другому менеджеру
 * @route POST /api/clients/:id/transfer
 * @access Manager & Admin
 */
export const transferClientToUser = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { to_user_id, transferred_notes } = req.body;
    const fromUserId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    if (!to_user_id) {
        throw new AppError('Требуется ID целевого менеджера', 400);
    }

    // Проверяем, что клиент существует и доступен пользователю
    let clientCheck;
    if (isAdmin) {
        clientCheck = await pool.query('SELECT id FROM clients WHERE id = $1', [id]);
    } else {
        // Менеджер может передавать клиента, если:
        // 1. Клиент назначен ему
        // 2. ИЛИ клиент находится в активном фильтре менеджера
        const filterCheck = await pool.query(
            `SELECT cf.id, cf.database_ids 
             FROM call_filters cf
             WHERE cf.is_active = true 
             AND (cf.user_ids IS NULL OR $1 = ANY(cf.user_ids))
             LIMIT 1`,
            [fromUserId]
        );

        if (filterCheck.rows.length > 0) {
            const activeFilter = filterCheck.rows[0];
            const databaseIds = activeFilter.database_ids;

            // Проверяем клиента с учетом фильтра или назначения
            if (databaseIds && databaseIds.length > 0) {
                clientCheck = await pool.query(
                    `SELECT id FROM clients 
                     WHERE id = $1 
                     AND (assigned_to = $2 OR database_id = ANY($3))`,
                    [id, fromUserId, databaseIds]
                );
            } else {
                // Если нет фильтра по базам, проверяем только назначение
                clientCheck = await pool.query(
                    'SELECT id FROM clients WHERE id = $1 AND assigned_to = $2',
                    [id, fromUserId]
                );
            }
        } else {
            // Нет активного фильтра - проверяем только назначение
            clientCheck = await pool.query(
                'SELECT id FROM clients WHERE id = $1 AND assigned_to = $2',
                [id, fromUserId]
            );
        }
    }

    if (clientCheck.rows.length === 0) {
        throw new AppError('Клиент не найден или не доступен для вас', 404);
    }

    // Проверяем существование целевого менеджера
    const userCheck = await pool.query(
        'SELECT id, username FROM users WHERE id = $1 AND role = $2',
        [to_user_id, 'manager']
    );

    if (userCheck.rows.length === 0) {
        throw new AppError('Целевой менеджер не найден', 404);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Обновляем клиента
        const updateResult = await client.query<Client>(
            `UPDATE clients 
             SET assigned_to = $1, 
                 call_status = 'передать',
                 transferred_to = $2,
                 transferred_notes = $3,
                 transfer_date = NOW(),
                 updated_at = NOW()
             WHERE id = $4
             RETURNING *`,
            [to_user_id, to_user_id, transferred_notes || null, id]
        );

        // Добавляем запись в историю
        await client.query(
            `INSERT INTO call_history (client_id, user_id, call_status, notes)
             VALUES ($1, $2, 'передать', $3)`,
            [id, fromUserId, transferred_notes || `Передан менеджеру ${userCheck.rows[0].username}`]
        );

        await client.query('COMMIT');

        // Push уведомление целевому пользователю
        try {
            await sendPushToUser(to_user_id, {
                title: 'Переданный клиент',
                body: `Новый клиент передан: ${updateResult.rows[0].ceo_name || updateResult.rows[0].company_name || ''}`,
                data: { url: '/profile' }
            });
        } catch {}

        res.json({
            success: true,
            data: updateResult.rows[0],
            message: `Клиент успешно передан менеджеру ${userCheck.rows[0].username}`
        });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Передать клиента другому менеджеру
 * @route POST /api/clients/transfer
 * @access Manager
 */
export const transferClient = async (req: AuthRequest, res: Response) => {
    const { client_id, to_user_id, reason }: TransferClientDTO = req.body;
    const fromUserId = req.user?.id;

    if (!client_id || !to_user_id) {
        throw new AppError('Требуется ID клиента и ID целевого менеджера', 400);
    }

    // Проверяем, что клиент принадлежит текущему менеджеру
    const clientCheck = await pool.query(
        'SELECT id FROM clients WHERE id = $1 AND assigned_to = $2',
        [client_id, fromUserId]
    );

    if (clientCheck.rows.length === 0) {
        throw new AppError('Клиент не найден или не принадлежит вам', 404);
    }

    // Проверяем существование целевого менеджера
    const userCheck = await pool.query(
        'SELECT id FROM users WHERE id = $1 AND role = $2',
        [to_user_id, 'manager']
    );

    if (userCheck.rows.length === 0) {
        throw new AppError('Целевой менеджер не найден', 404);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Обновляем клиента
        const updateResult = await client.query<Client>(
            `UPDATE clients SET assigned_to = $1, call_status = 'передать', updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
            [to_user_id, client_id]
        );

        // Добавляем запись в историю
        await client.query(
            `INSERT INTO call_history (client_id, user_id, call_status, notes)
       VALUES ($1, $2, 'передать', $3)`,
            [client_id, fromUserId, reason || 'Передан другому менеджеру']
        );

        // Добавляем заметку о передаче
        if (reason) {
            await client.query(
                `INSERT INTO client_notes (client_id, user_id, note_text)
         VALUES ($1, $2, $3)`,
                [client_id, fromUserId, `Передано: ${reason}`]
            );
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            data: updateResult.rows[0],
            message: 'Клиент успешно передан'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Получить заметки по клиенту
 * @route GET /api/clients/:id/notes
 * @access Manager (только свои клиенты), Admin (все)
 */
export const getClientNotes = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    // Проверяем доступ к клиенту
    if (!isAdmin) {
        // Менеджер может просматривать заметки, если:
        // 1. Клиент назначен ему
        // 2. ИЛИ клиент находится в активном фильтре менеджера
        const filterCheck = await pool.query(
            `SELECT cf.id, cf.database_ids 
             FROM call_filters cf
             WHERE cf.is_active = true 
             AND (cf.user_ids IS NULL OR $1 = ANY(cf.user_ids))
             LIMIT 1`,
            [userId]
        );

        let clientCheck;
        if (filterCheck.rows.length > 0) {
            const activeFilter = filterCheck.rows[0];
            const databaseIds = activeFilter.database_ids;

            if (databaseIds && databaseIds.length > 0) {
                clientCheck = await pool.query(
                    `SELECT id FROM clients 
                     WHERE id = $1 
                     AND (assigned_to = $2 OR database_id = ANY($3))`,
                    [id, userId, databaseIds]
                );
            } else {
                clientCheck = await pool.query(
                    'SELECT id FROM clients WHERE id = $1 AND assigned_to = $2',
                    [id, userId]
                );
            }
        } else {
            clientCheck = await pool.query(
                'SELECT id FROM clients WHERE id = $1 AND assigned_to = $2',
                [id, userId]
            );
        }

        if (clientCheck.rows.length === 0) {
            throw new AppError('Клиент не найден или не доступен для вас', 404);
        }
    }

    const result = await pool.query(
        `SELECT cn.*, u.username 
     FROM client_notes cn
     LEFT JOIN users u ON cn.user_id = u.id
     WHERE cn.client_id = $1
     ORDER BY cn.created_at DESC`,
        [id]
    );

    res.json({
        success: true,
        data: result.rows
    });
};

/**
 * Добавить заметку к клиенту
 * @route POST /api/clients/:id/notes
 * @access Manager
 */
export const addClientNote = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { note } = req.body;
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    if (!note || note.trim().length === 0) {
        throw new AppError('Заметка не может быть пустой', 400);
    }

    // Проверяем доступ к клиенту
    let clientCheck;
    if (isAdmin) {
        clientCheck = await pool.query('SELECT id FROM clients WHERE id = $1', [id]);
    } else {
        // Менеджер может добавлять заметки, если:
        // 1. Клиент назначен ему
        // 2. ИЛИ клиент находится в активном фильтре менеджера
        const filterCheck = await pool.query(
            `SELECT cf.id, cf.database_ids 
             FROM call_filters cf
             WHERE cf.is_active = true 
             AND (cf.user_ids IS NULL OR $1 = ANY(cf.user_ids))
             LIMIT 1`,
            [userId]
        );

        if (filterCheck.rows.length > 0) {
            const activeFilter = filterCheck.rows[0];
            const databaseIds = activeFilter.database_ids;

            if (databaseIds && databaseIds.length > 0) {
                clientCheck = await pool.query(
                    `SELECT id FROM clients 
                     WHERE id = $1 
                     AND (assigned_to = $2 OR database_id = ANY($3))`,
                    [id, userId, databaseIds]
                );
            } else {
                clientCheck = await pool.query(
                    'SELECT id FROM clients WHERE id = $1 AND assigned_to = $2',
                    [id, userId]
                );
            }
        } else {
            clientCheck = await pool.query(
                'SELECT id FROM clients WHERE id = $1 AND assigned_to = $2',
                [id, userId]
            );
        }
    }

    if (clientCheck.rows.length === 0) {
        throw new AppError('Клиент не найден или не доступен для вас', 404);
    }

    const result = await pool.query(
        `INSERT INTO client_notes (client_id, user_id, note_text)
     VALUES ($1, $2, $3)
     RETURNING *`,
        [id, userId, note.trim()]
    );

    res.status(201).json({
        success: true,
        data: result.rows[0],
        message: 'Заметка успешно добавлена'
    });
};

/**
 * Получить информацию о последней передаче клиента (кто передал и когда)
 * @route GET /api/clients/:id/transfer-info
 * @access Manager (свои клиенты) & Admin (все)
 */
export const getClientTransferInfo = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    // Проверяем доступ к клиенту
    if (!isAdmin) {
        const check = await pool.query('SELECT id FROM clients WHERE id = $1 AND (assigned_to = $2 OR transferred_to = $2)', [id, userId]);
        if (check.rows.length === 0) {
            throw new AppError('Клиент не найден или недоступен для вас', 404);
        }
    }

    const result = await pool.query(
        `SELECT ch.id, ch.created_at AS transfer_date, ch.notes, u.id as from_user_id, u.username as from_username
         FROM call_history ch
         LEFT JOIN users u ON ch.user_id = u.id
         WHERE ch.client_id = $1 AND ch.call_status = 'передать'
         ORDER BY ch.created_at DESC
         LIMIT 1`,
        [id]
    );

    res.json({
        success: true,
        data: result.rows.length ? result.rows[0] : null
    });
};

/**
 * Вернуть клиента в работу и поставить приоритет для текущего менеджера
 * @route POST /api/clients/:id/return-to-work
 * @access Manager & Admin
 */
export const returnClientToWork = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    // Доступ: админ всем, менеджер — своим или из активного фильтра
    let clientCheck;
    if (isAdmin) {
        clientCheck = await pool.query('SELECT id FROM clients WHERE id = $1', [id]);
    } else {
        const filterCheck = await pool.query(
            `SELECT cf.id, cf.database_ids 
             FROM call_filters cf
             WHERE cf.is_active = true 
               AND (cf.user_ids IS NULL OR $1 = ANY(cf.user_ids))
             LIMIT 1`,
            [userId]
        );

        if (filterCheck.rows.length > 0) {
            const databaseIds = filterCheck.rows[0].database_ids;
            if (databaseIds && databaseIds.length > 0) {
                clientCheck = await pool.query(
                    `SELECT id FROM clients 
                     WHERE id = $1 
                       AND (assigned_to = $2 OR database_id = ANY($3))`,
                    [id, userId, databaseIds]
                );
            } else {
                clientCheck = await pool.query(
                    'SELECT id FROM clients WHERE id = $1 AND assigned_to = $2',
                    [id, userId]
                );
            }
        } else {
            clientCheck = await pool.query(
                'SELECT id FROM clients WHERE id = $1 AND assigned_to = $2',
                [id, userId]
            );
        }
    }

    if (clientCheck.rows.length === 0) {
        throw new AppError('Клиент не найден или недоступен для вас', 404);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const updateResult = await client.query<Client>(
            `UPDATE clients 
             SET call_status = NULL,
                 callback_datetime = NULL,
                 callback_notes = NULL,
                 transferred_to = NULL,
                 transferred_notes = NULL,
                 return_priority = true,
                 assigned_to = COALESCE(assigned_to, $2),
                 updated_at = NOW()
             WHERE id = $1 AND (assigned_to IS NULL OR assigned_to = $2)
             RETURNING *`,
            [id, userId]
        );

        if (updateResult.rows.length === 0 && !isAdmin) {
            throw new AppError('Клиент уже закреплён за другим менеджером', 409);
        }

        await client.query(
            `INSERT INTO call_history (client_id, user_id, call_status, notes)
             VALUES ($1, $2, 'новый', $3)`,
            [id, userId, 'Возвращен в работу']
        );

        await client.query('COMMIT');
        res.json({ success: true, data: updateResult.rows[0], message: 'Клиент возвращён в работу' });
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

/**
 * Удалить клиента из разделов профиля (перезвон/переданные)
 * @route POST /api/clients/:id/profile/remove
 * @access Manager & Admin
 */
export const removeClientFromProfile = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { section } = req.body as { section: 'перезвон' | 'передать' };
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    if (!section || (section !== 'перезвон' && section !== 'передать')) {
        throw new AppError('Некорректный раздел', 400);
    }

    let clientCheck;
    if (isAdmin) {
        clientCheck = await pool.query('SELECT id FROM clients WHERE id = $1', [id]);
    } else {
        clientCheck = await pool.query('SELECT id FROM clients WHERE id = $1 AND assigned_to = $2', [id, userId]);
    }

    if (clientCheck.rows.length === 0) {
        throw new AppError('Клиент не найден или недоступен для вас', 404);
    }

    const fieldsReset = section === 'перезвон'
        ? `callback_datetime = NULL, callback_notes = NULL, call_status = NULL`
        : `transferred_to = NULL, transferred_notes = NULL, call_status = NULL`;

    const result = await pool.query<Client>(
        `UPDATE clients SET ${fieldsReset}, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
    );

    return res.json({ success: true, data: result.rows[0], message: 'Клиент удалён из раздела профиля' });
};

