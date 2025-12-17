import { Request, Response } from 'express';
import pool from '../config/database';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * @desc    Получить все фильтры
 * @route   GET /api/filters
 * @access  Private
 */
export const getFilters = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;

    const result = await pool.query(
        `SELECT 
            f.id,
            f.name,
            f.database_ids,
            f.user_ids,
            f.statuses,
            f.created_by,
            f.is_active,
            f.created_at,
            f.updated_at,
            u.username as created_by_username
        FROM call_filters f
        LEFT JOIN users u ON f.created_by = u.id
        WHERE EXISTS (
            SELECT 1 FROM databases d 
            WHERE d.id = ANY(f.database_ids) AND (d.is_wiki = false OR d.is_wiki IS NULL)
        )
        ORDER BY f.is_active DESC, f.created_at DESC`
    );

    // Получаем названия баз для каждого фильтра
    const filters = await Promise.all(result.rows.map(async (filter) => {
        const dbIds = filter.database_ids || [];
        let databaseNames: string[] = [];

        if (dbIds.length > 0) {
            const dbResult = await pool.query(
                'SELECT id, name FROM databases WHERE id = ANY($1::int[]) AND (is_wiki = false OR is_wiki IS NULL)',
                [dbIds]
            );
            databaseNames = dbResult.rows.map(db => db.name);
        }

        // Получаем имена пользователей
        let usernames: string[] = [];
        if (filter.user_ids && filter.user_ids.length > 0) {
            const userResult = await pool.query(
                'SELECT full_name FROM users WHERE id = ANY($1::int[])',
                [filter.user_ids]
            );
            usernames = userResult.rows.map(u => u.full_name);
        }

        // Подсчитываем количество оставшихся контактов
        let remainingContacts = 0;
        if (dbIds.length > 0) {
            const statuses = filter.statuses || [];
            let whereConditions = ['database_id = ANY($1::int[])', '(is_wiki = false OR is_wiki IS NULL)'];
            const values: any[] = [dbIds];

            // Фильтр по статусам
            if (statuses.length > 0) {
                const statusConditions: string[] = [];
                const hasNewStatus = statuses.includes('новый');
                const otherStatuses = statuses.filter((s: string) => s !== 'новый');

                if (hasNewStatus) {
                    statusConditions.push('call_status IS NULL');
                }

                if (otherStatuses.length > 0) {
                    statusConditions.push('call_status = ANY($2::text[])');
                    values.push(otherStatuses);
                }

                if (statusConditions.length > 0) {
                    whereConditions.push(`(${statusConditions.join(' OR ')})`);
                }
            }

            const countQuery = `SELECT COUNT(*) as count FROM clients WHERE ${whereConditions.join(' AND ')}`;
            const countResult = await pool.query(countQuery, values);
            remainingContacts = parseInt(countResult.rows[0].count) || 0;
        }

        // Подсчитываем общее количество контактов в выбранных базах
        let totalContacts = 0;
        if (dbIds.length > 0) {
            const totalResult = await pool.query(
                'SELECT COUNT(*) as count FROM clients WHERE database_id = ANY($1::int[]) AND (is_wiki = false OR is_wiki IS NULL)',
                [dbIds]
            );
            totalContacts = parseInt(totalResult.rows[0].count) || 0;
        }

        const processedContacts = totalContacts - remainingContacts;

        return {
            ...filter,
            database_names: databaseNames,
            usernames,
            remaining_contacts: remainingContacts,
            total_contacts: totalContacts,
            processed_contacts: processedContacts
        };
    }));

    res.json(filters);
});

/**
 * @desc    Получить все Wiki-фильтры
 * @route   GET /api/filters/wiki
 * @access  Private
 */
export const getWikiFilters = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;

    const result = await pool.query(
        `SELECT 
            f.id,
            f.name,
            f.database_ids,
            f.user_ids,
            f.statuses,
            f.created_by,
            f.is_active,
            f.created_at,
            f.updated_at,
            u.username as created_by_username
        FROM call_filters f
        LEFT JOIN users u ON f.created_by = u.id
        WHERE EXISTS (
            SELECT 1 FROM databases d 
            WHERE d.id = ANY(f.database_ids) AND d.is_wiki = true
        )
        ORDER BY f.is_active DESC, f.created_at DESC`
    );

    // Получаем названия баз для каждого фильтра (только Wiki-базы)
    const filters = await Promise.all(result.rows.map(async (filter) => {
        const dbIds = filter.database_ids || [];
        let databaseNames: string[] = [];

        if (dbIds.length > 0) {
            const dbResult = await pool.query(
                'SELECT id, name FROM databases WHERE id = ANY($1::int[]) AND is_wiki = true',
                [dbIds]
            );
            databaseNames = dbResult.rows.map(db => db.name);
        }

        // Получаем имена пользователей
        let usernames: string[] = [];
        if (filter.user_ids && filter.user_ids.length > 0) {
            const userResult = await pool.query(
                'SELECT full_name FROM users WHERE id = ANY($1::int[])',
                [filter.user_ids]
            );
            usernames = userResult.rows.map(u => u.full_name);
        }

        // Подсчитываем количество оставшихся контактов (только Wiki)
        let remainingContacts = 0;
        if (dbIds.length > 0) {
            const statuses = filter.statuses || [];
            let whereConditions = ['database_id = ANY($1::int[])', 'is_wiki = true'];
            const values: any[] = [dbIds];

            // Фильтр по статусам
            if (statuses.length > 0) {
                const statusConditions: string[] = [];
                const hasNewStatus = statuses.includes('новый');
                const otherStatuses = statuses.filter((s: string) => s !== 'новый');

                if (hasNewStatus) {
                    statusConditions.push('call_status IS NULL');
                }

                if (otherStatuses.length > 0) {
                    statusConditions.push('call_status = ANY($2::text[])');
                    values.push(otherStatuses);
                }

                if (statusConditions.length > 0) {
                    whereConditions.push(`(${statusConditions.join(' OR ')})`);
                }
            }

            const countQuery = `SELECT COUNT(*) as count FROM clients WHERE ${whereConditions.join(' AND ')}`;
            const countResult = await pool.query(countQuery, values);
            remainingContacts = parseInt(countResult.rows[0].count) || 0;
        }

        // Подсчитываем общее количество контактов в выбранных базах (только Wiki)
        let totalContacts = 0;
        if (dbIds.length > 0) {
            const totalResult = await pool.query(
                'SELECT COUNT(*) as count FROM clients WHERE database_id = ANY($1::int[]) AND is_wiki = true',
                [dbIds]
            );
            totalContacts = parseInt(totalResult.rows[0].count) || 0;
        }

        const processedContacts = totalContacts - remainingContacts;

        return {
            ...filter,
            database_names: databaseNames,
            usernames,
            remaining_contacts: remainingContacts,
            total_contacts: totalContacts,
            processed_contacts: processedContacts
        };
    }));

    res.json(filters);
});

/**
 * @desc    Получить фильтр по ID
 * @route   GET /api/filters/:id
 * @access  Private
 */
export const getFilterById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const result = await pool.query(
        'SELECT * FROM call_filters WHERE id = $1 AND is_active = true',
        [id]
    );

    if (result.rows.length === 0) {
        res.status(404).json({ message: 'Фильтр не найден' });
        return;
    }

    res.json(result.rows[0]);
});

/**
 * @desc    Создать новый фильтр
 * @route   POST /api/filters
 * @access  Private
 */
export const createFilter = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const { name, database_ids, user_ids, statuses } = req.body;

    if (!name || !database_ids || database_ids.length === 0) {
        res.status(400).json({ message: 'Название и базы данных обязательны' });
        return;
    }

    const result = await pool.query(
        `INSERT INTO call_filters (name, database_ids, user_ids, statuses, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [name, database_ids, user_ids || null, statuses || null, userId]
    );

    res.status(201).json(result.rows[0]);
});

/**
 * @desc    Обновить фильтр
 * @route   PUT /api/filters/:id
 * @access  Private
 */
export const updateFilter = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, database_ids, user_ids, statuses } = req.body;

    const result = await pool.query(
        `UPDATE call_filters 
         SET name = $1, database_ids = $2, user_ids = $3, statuses = $4
         WHERE id = $5 AND is_active = true
         RETURNING *`,
        [name, database_ids, user_ids || null, statuses || null, id]
    );

    if (result.rows.length === 0) {
        res.status(404).json({ message: 'Фильтр не найден' });
        return;
    }

    res.json(result.rows[0]);
});

/**
 * @desc    Переключить активность фильтра
 * @route   PATCH /api/filters/:id/toggle
 * @access  Private
 */
export const toggleFilter = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { is_active } = req.body;

    const result = await pool.query(
        'UPDATE call_filters SET is_active = $1 WHERE id = $2 RETURNING *',
        [is_active, id]
    );

    if (result.rows.length === 0) {
        res.status(404).json({ message: 'Фильтр не найден' });
        return;
    }

    res.json(result.rows[0]);
});

/**
 * @desc    Удалить фильтр (soft delete)
 * @route   DELETE /api/filters/:id
 * @access  Private
 */
export const deleteFilter = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const result = await pool.query(
        'DELETE FROM call_filters WHERE id = $1 RETURNING *',
        [id]
    );

    if (result.rows.length === 0) {
        res.status(404).json({ message: 'Фильтр не найден' });
        return;
    }

    res.json({ message: 'Фильтр удален' });
});

/**
 * @desc    Получить следующего клиента на основе фильтра
 * @route   GET /api/filters/:id/next-client
 * @access  Private
 */
export const getNextClientByFilter = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    // Получаем фильтр
    const filterResult = await pool.query(
        'SELECT * FROM call_filters WHERE id = $1 AND is_active = true',
        [id]
    );

    if (filterResult.rows.length === 0) {
        res.status(404).json({ message: 'Фильтр не найден' });
        return;
    }

    const filter = filterResult.rows[0];
    const { database_ids, user_ids, statuses } = filter;

    // Транзакционно выбираем и «захватываем» клиента
    const db = await pool.connect();
    try {
        await db.query('BEGIN');

        const conditions: string[] = ['c.database_id = ANY($1::int[])', 'c.is_active = true'];
        const params: any[] = [database_ids];
        let idx = 2;

        if (user_ids && user_ids.length > 0) {
            // Разрешены конкретные пользователи: берём не назначенных или назначенных одному из этих пользователей
            conditions.push(`(c.assigned_to IS NULL OR c.assigned_to = ANY($${idx}::int[]))`);
            params.push(user_ids);
            idx++;
        } else {
            // Если пользователи не указаны: админ — свои или NULL, менеджер — только свои или NULL
            if (userRole === 'admin') {
                conditions.push(`(c.assigned_to IS NULL OR c.assigned_to = $${idx})`);
            } else {
                conditions.push(`(c.assigned_to IS NULL OR c.assigned_to = $${idx})`);
            }
            params.push(userId);
            idx++;
        }

        if (statuses && statuses.length > 0) {
            // Разрешаем NULL как «новый» в рамках фильтра
            conditions.push(`(c.call_status IS NULL OR c.call_status = ANY($${idx}::varchar[]))`);
            params.push(statuses);
            idx++;
        }

        const selectRes = await db.query<{ id: number }>(
            `SELECT c.id
             FROM clients c
             WHERE ${conditions.join(' AND ')}
             ORDER BY c.created_at ASC
             FOR UPDATE SKIP LOCKED
             LIMIT 1`,
            params
        );

        if (selectRes.rows.length === 0) {
            await db.query('ROLLBACK');
            res.status(404).json({ message: 'Нет доступных клиентов по этому фильтру' });
            return;
        }

        const claimed = await db.query(
            `UPDATE clients
             SET assigned_to = COALESCE(assigned_to, $1), updated_at = NOW()
             WHERE id = $2 AND (assigned_to IS NULL OR assigned_to = $1)
             RETURNING *`,
            [userId, selectRes.rows[0].id]
        );

        await db.query('COMMIT');
        res.json(claimed.rows[0]);
    } catch (e) {
        await db.query('ROLLBACK');
        throw e;
    } finally {
        db.release();
    }
});
