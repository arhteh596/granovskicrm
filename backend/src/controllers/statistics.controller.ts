import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';

/**
 * Получить глобальную статистику (для администратора)
 * @route GET /api/statistics/global
 * @access Admin only
 */
export const getGlobalStatistics = async (req: AuthRequest, res: Response) => {
    const { start_date, end_date } = req.query;

    const conditions: string[] = [];
    const params: any[] = [];

    if (start_date) {
        params.push(start_date);
        conditions.push(`call_date >= $${params.length}`);
    }

    if (end_date) {
        params.push(end_date);
        conditions.push(`call_date <= $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const dayRangeClause = whereClause || `WHERE call_date >= NOW() - INTERVAL '30 days'`;
    const joinClause = conditions.length ? `ON u.id = ch.user_id AND ${conditions
        .map((c) => c.replace('call_date', 'ch.call_date'))
        .join(' AND ')}` : 'ON u.id = ch.user_id';

    // Общее количество звонков
    const callsCount = await pool.query(
        `SELECT COUNT(*) as count FROM call_history ${whereClause}`,
        params
    );

    // Успешные звонки (взял код)
    const successfulCalls = await pool.query(
        `SELECT COUNT(*) as count FROM call_history ${whereClause ? `${whereClause} AND call_status = 'взял код'` : "WHERE call_status = 'взял код'"}`,
        params
    );

    // Средняя длительность звонка
    const avgDuration = await pool.query(
        `SELECT COALESCE(AVG(duration), 0) as avg_duration FROM call_history ${whereClause ? `${whereClause} AND duration > 0` : 'WHERE duration > 0'}`,
        params
    );

    // Статистика по статусам звонков
    const callsByStatus = await pool.query(
        `SELECT call_status, COUNT(*) as count
         FROM call_history
         ${whereClause ? `${whereClause} AND call_status IS NOT NULL` : 'WHERE call_status IS NOT NULL'}
         GROUP BY call_status
         ORDER BY count DESC`,
        params
    );

    // Топ операторов
    const topOperators = await pool.query(
        `SELECT 
            u.id as user_id,
            u.full_name,
            COUNT(ch.id) as total_calls,
            COUNT(CASE WHEN ch.call_status = 'взял код' THEN 1 END) as successful_calls,
            ROUND(
                CASE 
                    WHEN COUNT(ch.id) > 0 THEN (COUNT(CASE WHEN ch.call_status = 'взял код' THEN 1 END)::numeric / COUNT(ch.id) * 100)
                    ELSE 0
                END, 
                2
            ) as efficiency
            FROM users u
            LEFT JOIN call_history ch ${joinClause}
            WHERE u.role IN ('manager', 'admin')
            GROUP BY u.id, u.full_name
            HAVING COUNT(ch.id) > 0
            ORDER BY total_calls DESC
            LIMIT 50`,
           params
    );

    // Звонки за последние 30 дней
    const callsByDay = await pool.query(
        `SELECT 
            DATE(call_date) as date,
            COUNT(*) as count,
            COUNT(CASE WHEN call_status = 'взял код' THEN 1 END) as success_count
         FROM call_history
         ${dayRangeClause}
         GROUP BY DATE(call_date)
         ORDER BY date ASC`,
        params
    );

    // Формируем объект callsByStatus
    const statusMap: Record<string, number> = {};
    callsByStatus.rows.forEach((row: any) => {
        statusMap[row.call_status] = parseInt(row.count);
    });

    res.json({
        success: true,
        data: {
            summary: {
                totalCalls: parseInt(callsCount.rows[0].count),
                successfulCalls: parseInt(successfulCalls.rows[0].count),
                averageCallDuration: Math.round(parseFloat(avgDuration.rows[0].avg_duration)),
                callsByStatus: statusMap
            },
            topOperators: topOperators.rows.map((row: any) => ({
                userId: row.user_id,
                username: row.full_name,
                totalCalls: parseInt(row.total_calls),
                successfulCalls: parseInt(row.successful_calls),
                efficiency: parseFloat(row.efficiency)
            })),
            callsByDay: callsByDay.rows.map((row: any) => ({
                date: row.date,
                count: parseInt(row.count),
                successCount: parseInt(row.success_count)
            }))
        }
    });
};

/**
 * Получить статистику конкретного пользователя
 * @route GET /api/statistics/user/:userId
 * @access Admin (все), Manager (только свою)
 */
export const getUserStatistics = async (req: AuthRequest, res: Response) => {
    const { userId } = req.params;
    const currentUserId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    // Менеджер может видеть только свою статистику
    if (!isAdmin && parseInt(userId) !== currentUserId) {
        return res.status(403).json({
            success: false,
            message: 'Недостаточно прав'
        });
    }

    // Информация о пользователе
    const userInfo = await pool.query(
        'SELECT id, username, role, created_at FROM users WHERE id = $1',
        [userId]
    );

    if (userInfo.rows.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Пользователь не найден'
        });
    }

    // Общее количество назначенных клиентов
    const assignedClients = await pool.query(
        'SELECT COUNT(*) as count FROM clients WHERE assigned_to = $1',
        [userId]
    );

    // Количество обработанных клиентов (со статусом)
    const processedClients = await pool.query(
        'SELECT COUNT(*) as count FROM clients WHERE assigned_to = $1 AND call_status IS NOT NULL',
        [userId]
    );

    // Общее количество звонков
    const totalCalls = await pool.query(
        'SELECT COUNT(*) as count FROM call_history WHERE user_id = $1',
        [userId]
    );

    // Успешные звонки
    const successfulCalls = await pool.query(
        "SELECT COUNT(*) as count FROM call_history WHERE user_id = $1 AND call_status = 'взял код'",
        [userId]
    );

    // Звонки на перезвон
    const callbackCalls = await pool.query(
        "SELECT COUNT(*) as count FROM call_history WHERE user_id = $1 AND call_status = 'перезвон'",
        [userId]
    );

    // Статистика по статусам
    const callsByStatus = await pool.query(
        `SELECT call_status, COUNT(*) as count
     FROM call_history
     WHERE user_id = $1
     GROUP BY call_status
     ORDER BY count DESC`,
        [userId]
    );

    // Активность по дням (последние 30 дней)
    const dailyActivity = await pool.query(
        `SELECT 
      DATE(created_at) as date,
      COUNT(*) as total_calls,
      COUNT(CASE WHEN call_status = 'взял код' THEN 1 END) as successful_calls
     FROM call_history
     WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
     GROUP BY DATE(created_at)
     ORDER BY date DESC`,
        [userId]
    );

    // Клиенты по статусам
    const clientsByStatus = await pool.query(
        `SELECT 
      call_status,
      COUNT(*) as count
     FROM clients
     WHERE assigned_to = $1 AND call_status IS NOT NULL
     GROUP BY call_status
     ORDER BY count DESC`,
        [userId]
    );

    // Средняя конверсия
    const totalCallsCount = parseInt(totalCalls.rows[0].count);
    const successfulCallsCount = parseInt(successfulCalls.rows[0].count);
    const conversionRate = totalCallsCount > 0
        ? ((successfulCallsCount / totalCallsCount) * 100).toFixed(2)
        : '0.00';

    res.json({
        success: true,
        data: {
            user: userInfo.rows[0],
            overview: {
                assigned_clients: parseInt(assignedClients.rows[0].count),
                processed_clients: parseInt(processedClients.rows[0].count),
                total_calls: totalCallsCount,
                successful_calls: successfulCallsCount,
                callback_calls: parseInt(callbackCalls.rows[0].count),
                conversion_rate: parseFloat(conversionRate)
            },
            calls_by_status: callsByStatus.rows,
            daily_activity: dailyActivity.rows,
            clients_by_status: clientsByStatus.rows
        }
    });
};

/**
 * Получить статистику звонков по датам
 * @route GET /api/statistics/calls-by-date
 * @access Admin (все), Manager (только свои)
 */
export const getCallsByDate = async (req: AuthRequest, res: Response) => {
    const { start_date, end_date, user_id } = req.query;
    const currentUserId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    // Определяем, чью статистику показывать
    let targetUserId: number | null = null;
    if (user_id) {
        if (isAdmin) {
            targetUserId = parseInt(user_id as string);
        } else if (parseInt(user_id as string) === currentUserId) {
            targetUserId = currentUserId!;
        } else {
            return res.status(403).json({
                success: false,
                message: 'Недостаточно прав'
            });
        }
    } else if (!isAdmin) {
        targetUserId = currentUserId!;
    }

    let query = `
    SELECT 
      DATE(ch.created_at) as date,
      COUNT(*) as total_calls,
      COUNT(CASE WHEN ch.call_status = 'взял код' THEN 1 END) as successful_calls,
      COUNT(CASE WHEN ch.call_status = 'перезвон' THEN 1 END) as callback_calls,
      COUNT(CASE WHEN ch.call_status = 'не дозвон' THEN 1 END) as missed_calls,
      COUNT(DISTINCT ch.client_id) as unique_clients
    FROM call_history ch
    WHERE 1=1
  `;

    const values: any[] = [];
    let paramIndex = 1;

    if (targetUserId) {
        query += ` AND ch.user_id = $${paramIndex++}`;
        values.push(targetUserId);
    }

    if (start_date) {
        query += ` AND ch.created_at >= $${paramIndex++}`;
        values.push(start_date);
    }

    if (end_date) {
        query += ` AND ch.created_at <= $${paramIndex++}`;
        values.push(end_date);
    }

    query += ` GROUP BY DATE(ch.created_at) ORDER BY date DESC`;

    const result = await pool.query(query, values);

    res.json({
        success: true,
        data: result.rows
    });
};

/**
 * Получить сравнительную статистику менеджеров
 * @route GET /api/statistics/managers-comparison
 * @access Admin only
 */
export const getManagersComparison = async (req: AuthRequest, res: Response) => {
    const { start_date, end_date } = req.query;

    let query = `
    SELECT 
      u.id,
      u.username,
      COUNT(DISTINCT c.id) as assigned_clients,
      COUNT(ch.id) as total_calls,
      COUNT(CASE WHEN ch.call_status = 'взял код' THEN 1 END) as successful_calls,
      COUNT(CASE WHEN ch.call_status = 'перезвон' THEN 1 END) as callback_calls,
      ROUND(
        CASE 
          WHEN COUNT(ch.id) > 0 THEN (COUNT(CASE WHEN ch.call_status = 'взял код' THEN 1 END)::numeric / COUNT(ch.id) * 100)
          ELSE 0
        END, 
        2
      ) as conversion_rate
    FROM users u
    LEFT JOIN clients c ON u.id = c.assigned_to
    LEFT JOIN call_history ch ON u.id = ch.user_id
  `;

    const values: any[] = [];
    let paramIndex = 1;

    if (start_date || end_date) {
        query += ' WHERE ';
        const conditions: string[] = [];

        if (start_date) {
            conditions.push(`ch.created_at >= $${paramIndex++}`);
            values.push(start_date);
        }

        if (end_date) {
            conditions.push(`ch.created_at <= $${paramIndex++}`);
            values.push(end_date);
        }

        query += conditions.join(' AND ');
    }

    query += `
    WHERE u.role = 'manager'
    GROUP BY u.id, u.username
    ORDER BY total_calls DESC
  `;

    const result = await pool.query(query, values);

    res.json({
        success: true,
        data: result.rows
    });
};

/**
 * Получить личную статистику менеджера
 * @route GET /api/statistics/manager/personal
 * @access Manager only
 */
export const getManagerPersonalStats = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        console.log('getManagerPersonalStats called for user:', userId);

        const { date_from, date_to } = req.query;

        let whereClause = 'WHERE ch.user_id = $1';
        const queryParams: any[] = [userId];
        let paramCount = 1;

        // Добавляем фильтр по дате если указан
        if (date_from) {
            paramCount++;
            whereClause += ` AND ch.call_date >= $${paramCount}`;
            queryParams.push(date_from);
        }

        if (date_to) {
            paramCount++;
            whereClause += ` AND ch.call_date <= $${paramCount}`;
            queryParams.push(date_to);
        }

        console.log('Query params:', queryParams);
        console.log('Where clause:', whereClause);

        // Основная статистика
        const statsQuery = `
            SELECT 
                COUNT(*) as total_calls,
                COUNT(CASE WHEN ch.call_status = 'взял код' THEN 1 END) as successful_calls,
                COUNT(CASE WHEN ch.call_status = 'не дозвон' THEN 1 END) as no_answer_calls,
                COUNT(CASE WHEN ch.call_status = 'срез' THEN 1 END) as cut_calls,
                AVG(ch.duration) as average_call_duration,
                ROUND(
                    CASE 
                        WHEN COUNT(*) > 0 THEN (COUNT(CASE WHEN ch.call_status = 'взял код' THEN 1 END)::numeric / COUNT(*) * 100)
                        ELSE 0
                    END, 
                    2
                ) as efficiency_percent,
                ROUND(
                    CASE 
                        WHEN COUNT(CASE WHEN ch.call_status = 'взял код' THEN 1 END) > 0 
                        THEN COUNT(*)::numeric / COUNT(CASE WHEN ch.call_status = 'взял код' THEN 1 END)
                        ELSE 0
                    END, 
                    2
                ) as calls_per_success
            FROM call_history ch
            INNER JOIN clients c ON ch.client_id = c.id
            ${whereClause}
        `;

        // Статистика по статусам
        const statusQuery = `
            SELECT 
                ch.call_status,
                COUNT(*) as count
            FROM call_history ch
            INNER JOIN clients c ON ch.client_id = c.id
            ${whereClause}
            GROUP BY ch.call_status
            ORDER BY count DESC
        `;

        const [stats, statusStats] = await Promise.all([
            pool.query(statsQuery, queryParams),
            pool.query(statusQuery, queryParams)
        ]);

        const callsByDayQuery = `
            SELECT 
                DATE(ch.call_date) as date,
                COUNT(*) as count,
                COUNT(CASE WHEN ch.call_status = 'взял код' THEN 1 END) as success_count
            FROM call_history ch
            INNER JOIN clients c ON ch.client_id = c.id
            ${whereClause}
            GROUP BY DATE(ch.call_date)
            ORDER BY date ASC
        `;

        const callsByDay = await pool.query(callsByDayQuery, queryParams);

        console.log('Stats result:', stats.rows[0]);
        console.log('Status stats result:', statusStats.rows);

        // Преобразуем статусы в объект
        const callsByStatus: Record<string, number> = {};
        statusStats.rows.forEach(row => {
            callsByStatus[row.call_status] = parseInt(row.count);
        });

        res.json({
            success: true,
            data: {
                summary: {
                    totalCalls: parseInt(stats.rows[0].total_calls) || 0,
                    successfulCalls: parseInt(stats.rows[0].successful_calls) || 0,
                    averageCallDuration: parseFloat(stats.rows[0].average_call_duration) || 0,
                    callsByStatus: callsByStatus
                },
                callsPerSuccess: parseFloat(stats.rows[0].calls_per_success) || 0,
                cutCalls: parseInt(stats.rows[0].cut_calls) || 0,
                efficiencyPercent: parseFloat(stats.rows[0].efficiency_percent) || 0
            },
            callsByDay: callsByDay.rows.map((row: any) => ({
                date: row.date,
                count: parseInt(row.count),
                successCount: parseInt(row.success_count)
            }))
        });

    } catch (error) {
        console.error('Error getting manager personal stats:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения личной статистики'
        });
    }
};

/**
 * Получить историю звонков для менеджера
 * @route GET /api/statistics/manager/call-history
 * @access Manager only
 */
export const getManagerCallHistory = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;

        const { date_from, date_to, limit = 100, offset = 0 } = req.query;

        let whereClause = 'WHERE ch.user_id = $1';
        const queryParams: any[] = [userId];
        let paramCount = 1;

        // Добавляем фильтр по дате если указан
        if (date_from) {
            paramCount++;
            whereClause += ` AND ch.call_date >= $${paramCount}`;
            queryParams.push(date_from);
        }

        if (date_to) {
            paramCount++;
            whereClause += ` AND ch.call_date <= $${paramCount}`;
            queryParams.push(date_to);
        }

        // Основной запрос для получения истории звонков
        const callHistoryQuery = `
            SELECT 
                ch.id,
                c.ceo_name as full_name,
                c.phone,
                ch.call_status,
                ch.call_date,
                ch.duration,
                ch.notes
            FROM call_history ch
            INNER JOIN clients c ON ch.client_id = c.id
            ${whereClause}
            ORDER BY ch.call_date DESC
            LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `;

        queryParams.push(limit, offset);

        const callHistory = await pool.query(callHistoryQuery, queryParams);

        // Подсчет общего количества записей для пагинации
        const countQuery = `
            SELECT COUNT(*) as total
            FROM call_history ch
            INNER JOIN clients c ON ch.client_id = c.id
            ${whereClause}
        `;

        const totalCount = await pool.query(countQuery, queryParams.slice(0, -2));

        // Статистика за период
        const statsQuery = `
            SELECT 
                COUNT(*) as total_calls,
                COUNT(CASE WHEN ch.call_status = 'взял код' THEN 1 END) as successful_calls,
                COUNT(CASE WHEN ch.call_status = 'не дозвон' THEN 1 END) as no_answer_calls,
                COUNT(CASE WHEN ch.call_status = 'срез' THEN 1 END) as cut_calls,
                ROUND(
                    CASE 
                        WHEN COUNT(*) > 0 THEN (COUNT(CASE WHEN ch.call_status = 'взял код' THEN 1 END)::numeric / COUNT(*) * 100)
                        ELSE 0
                    END, 
                    2
                ) as efficiency_percent
            FROM call_history ch
            INNER JOIN clients c ON ch.client_id = c.id
            ${whereClause}
        `;

        const stats = await pool.query(statsQuery, queryParams.slice(0, -2));

        res.json({
            success: true,
            data: {
                calls: callHistory.rows.map(row => ({
                    id: row.id,
                    client_name: row.full_name || 'Не указано',
                    client_phone: row.phone || 'Не указан',
                    call_status: row.call_status,
                    call_date: row.call_date,
                    call_duration: row.duration || 0,
                    notes: row.notes
                })),
                pagination: {
                    total: parseInt(totalCount.rows[0].total),
                    limit: parseInt(limit as string),
                    offset: parseInt(offset as string),
                    has_more: parseInt(totalCount.rows[0].total) > parseInt(offset as string) + parseInt(limit as string)
                },
                statistics: stats.rows[0]
            }
        });

    } catch (error) {
        console.error('Error getting manager call history:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения истории звонков'
        });
    }
};

/**
 * Сбросить статистику звонков (удалить записи call_history)
 * @route POST /api/statistics/reset
 * @access Admin only
 */
export const resetStatistics = async (req: AuthRequest, res: Response) => {
    try {
        const { scope, date, start_date, end_date } = req.body as {
            scope: 'day' | 'period' | 'all';
            date?: string;
            start_date?: string;
            end_date?: string;
        };

        if (!['day', 'period', 'all'].includes(scope)) {
            return res.status(400).json({ success: false, message: 'Некорректный режим очистки' });
        }

        let whereClause = '';
        const params: any[] = [];

        if (scope === 'day') {
            if (!date) {
                return res.status(400).json({ success: false, message: 'Укажите дату для очистки' });
            }
            params.push(date);
            whereClause = 'WHERE DATE(call_date) = DATE($1)';
        }

        if (scope === 'period') {
            if (!start_date || !end_date) {
                return res.status(400).json({ success: false, message: 'Укажите период для очистки' });
            }
            params.push(start_date, end_date);
            whereClause = 'WHERE call_date::date BETWEEN DATE($1) AND DATE($2)';
        }

        const deleteQuery = `DELETE FROM call_history ${whereClause}`;
        const result = await pool.query(deleteQuery, params);

        res.json({ success: true, deleted: result.rowCount });
    } catch (error) {
        console.error('Error resetting statistics:', error);
        res.status(500).json({ success: false, message: 'Не удалось очистить статистику' });
    }
};
