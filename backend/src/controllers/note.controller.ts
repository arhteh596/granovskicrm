import { Response, NextFunction } from 'express';
import pool from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';

// Получить все заметки пользователя
export const getMyNotes = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;

        const result = await pool.query(
            `SELECT cn.*, c.company_name, c.ceo_name 
             FROM client_notes cn
             LEFT JOIN clients c ON cn.client_id = c.id
             WHERE cn.user_id = $1
             ORDER BY cn.created_at DESC`,
            [userId]
        );

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};

// Создать заметку
export const createNote = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const { client_id, note_text } = req.body;

        if (!note_text) {
            throw new AppError('Note text is required', 400);
        }

        const result = await pool.query(
            `INSERT INTO client_notes (client_id, user_id, note_text)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [client_id, userId, note_text]
        );

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
};

// Обновить заметку
export const updateNote = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const { id } = req.params;
        const { note_text } = req.body;

        const result = await pool.query(
            `UPDATE client_notes
             SET note_text = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND user_id = $3
             RETURNING *`,
            [note_text, id, userId]
        );

        if (result.rows.length === 0) {
            throw new AppError('Note not found', 404);
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
};

// Удалить заметку
export const deleteNote = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM client_notes
             WHERE id = $1 AND user_id = $2
             RETURNING *`,
            [id, userId]
        );

        if (result.rows.length === 0) {
            throw new AppError('Note not found', 404);
        }

        res.json({
            success: true,
            message: 'Note deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};
