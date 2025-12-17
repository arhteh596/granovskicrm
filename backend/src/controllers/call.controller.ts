import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { CallHistory } from '../types';

/**
 * Получить историю звонков клиента
 * @route GET /api/calls/client/:clientId
 * @access Manager (только свои клиенты), Admin (все)
 */
export const getClientCallHistory = async (req: AuthRequest, res: Response) => {
    const { clientId } = req.params;
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    // Проверяем доступ к клиенту
    if (!isAdmin) {
        const clientCheck = await pool.query(
            'SELECT id FROM clients WHERE id = $1 AND assigned_to = $2',
            [clientId, userId]
        );
        if (clientCheck.rows.length === 0) {
            throw new AppError('Клиент не найден или не принадлежит вам', 404);
        }
    }

    const result = await pool.query<CallHistory>(
        `SELECT ch.*, u.username 
     FROM call_history ch
     LEFT JOIN users u ON ch.user_id = u.id
     WHERE ch.client_id = $1
     ORDER BY ch.created_at DESC`,
        [clientId]
    );

    res.json({
        success: true,
        data: result.rows,
        total: result.rows.length
    });
};

/**
 * Получить историю звонков пользователя
 * @route GET /api/calls/user/:userId
 * @access Admin (все), Manager (только свои)
 */
export const getUserCallHistory = async (req: AuthRequest, res: Response) => {
    const { userId } = req.params;
    const currentUserId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    // Менеджер может видеть только свою историю
    if (!isAdmin && parseInt(userId) !== currentUserId) {
        throw new AppError('Недостаточно прав', 403);
    }

    const { limit = 100, offset = 0, status } = req.query;

    let query = `
    SELECT ch.*, c.ceo_name, c.company_name, c.phone
    FROM call_history ch
    LEFT JOIN clients c ON ch.client_id = c.id
    WHERE ch.user_id = $1
  `;
    const values: any[] = [userId];
    let paramIndex = 2;

    if (status) {
        query += ` AND ch.call_status = $${paramIndex++}`;
        values.push(status);
    }

    query += ` ORDER BY ch.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    values.push(limit, offset);

    const result = await pool.query<CallHistory>(query, values);

    res.json({
        success: true,
        data: result.rows,
        total: result.rows.length
    });
};

/**
 * Получить всю историю звонков (для администратора)
 * @route GET /api/calls
 * @access Admin only
 */
export const getAllCallHistory = async (req: AuthRequest, res: Response) => {
    const { limit = 100, offset = 0, status, user_id } = req.query;

    let query = `
    SELECT ch.*, c.ceo_name, c.company_name, c.phone, u.username
    FROM call_history ch
    LEFT JOIN clients c ON ch.client_id = c.id
    LEFT JOIN users u ON ch.user_id = u.id
    WHERE 1=1
  `;
    const values: any[] = [];
    let paramIndex = 1;

    if (status) {
        query += ` AND ch.call_status = $${paramIndex++}`;
        values.push(status);
    }

    if (user_id) {
        query += ` AND ch.user_id = $${paramIndex++}`;
        values.push(user_id);
    }

    query += ` ORDER BY ch.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    values.push(limit, offset);

    const result = await pool.query<CallHistory>(query, values);

    res.json({
        success: true,
        data: result.rows,
        total: result.rows.length
    });
};

/**
 * Получить статистику звонков по статусам за период
 * @route GET /api/calls/stats/by-status
 * @access Manager (только свои), Admin (все или по пользователю)
 */
export const getCallStatsByStatus = async (req: AuthRequest, res: Response) => {
    const { user_id, start_date, end_date } = req.query;
    const currentUserId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    // Определяем, чью статистику показывать
    let targetUserId: number;
    if (isAdmin && user_id) {
        targetUserId = parseInt(user_id as string);
    } else {
        targetUserId = currentUserId!;
    }

    let query = `
    SELECT 
      call_status,
      COUNT(*) as count
    FROM call_history
    WHERE user_id = $1
  `;
    const values: any[] = [targetUserId];
    let paramIndex = 2;

    if (start_date) {
        query += ` AND created_at >= $${paramIndex++}`;
        values.push(start_date);
    }

    if (end_date) {
        query += ` AND created_at <= $${paramIndex++}`;
        values.push(end_date);
    }

    query += ` GROUP BY call_status ORDER BY count DESC`;

    const result = await pool.query(query, values);

    res.json({
        success: true,
        data: result.rows
    });
};

/**
 * Получить количество звонков по дням
 * @route GET /api/calls/stats/by-day
 * @access Manager (только свои), Admin (все или по пользователю)
 */
export const getCallStatsByDay = async (req: AuthRequest, res: Response) => {
    const { user_id, days = 7 } = req.query;
    const currentUserId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    // Определяем, чью статистику показывать
    let targetUserId: number;
    if (isAdmin && user_id) {
        targetUserId = parseInt(user_id as string);
    } else {
        targetUserId = currentUserId!;
    }

    const result = await pool.query(
        `SELECT 
      DATE(created_at) as date,
      COUNT(*) as total_calls,
      COUNT(CASE WHEN call_status = 'взял код' THEN 1 END) as successful_calls,
      COUNT(CASE WHEN call_status = 'перезвон' THEN 1 END) as callback_calls
    FROM call_history
    WHERE user_id = $1 
    AND created_at >= NOW() - INTERVAL '${parseInt(days as string)} days'
    GROUP BY DATE(created_at)
    ORDER BY date DESC`,
        [targetUserId]
    );

    res.json({
        success: true,
        data: result.rows
    });
};

/**
 * Удалить запись из истории (для администратора)
 * @route DELETE /api/calls/:id
 * @access Admin only
 */
export const deleteCallHistoryRecord = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const result = await pool.query(
        'DELETE FROM call_history WHERE id = $1 RETURNING id',
        [id]
    );

    if (result.rows.length === 0) {
        throw new AppError('Запись не найдена', 404);
    }

    res.json({
        success: true,
        message: 'Запись успешно удалена'
    });
};
