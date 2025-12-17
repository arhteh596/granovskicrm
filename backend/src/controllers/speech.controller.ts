import { Response, NextFunction } from 'express';
import pool from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';

// Получить все спичи пользователя
export const getMySpeeches = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;

        const result = await pool.query(
            `SELECT * FROM speeches
             WHERE user_id = $1
             ORDER BY is_favorite DESC, created_at DESC`,
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

// Создать спич
export const createSpeech = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const { title, content, is_favorite = false } = req.body;

        if (!title || !content) {
            throw new AppError('Title and content are required', 400);
        }

        const result = await pool.query(
            `INSERT INTO speeches (user_id, title, content, is_favorite)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [userId, title, content, is_favorite]
        );

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
};

// Обновить спич
export const updateSpeech = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const { id } = req.params;
        const { title, content, is_favorite } = req.body;

        const result = await pool.query(
            `UPDATE speeches
             SET title = COALESCE($1, title),
                 content = COALESCE($2, content),
                 is_favorite = COALESCE($3, is_favorite),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4 AND user_id = $5
             RETURNING *`,
            [title, content, is_favorite, id, userId]
        );

        if (result.rows.length === 0) {
            throw new AppError('Speech not found', 404);
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
};

// Удалить спич
export const deleteSpeech = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM speeches
             WHERE id = $4 AND user_id = $1
             RETURNING *`,
            [userId, id]
        );

        if (result.rows.length === 0) {
            throw new AppError('Speech not found', 404);
        }

        res.json({
            success: true,
            message: 'Speech deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

// Переключить избранное
export const toggleFavorite = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const { id } = req.params;

        const result = await pool.query(
            `UPDATE speeches
             SET is_favorite = NOT is_favorite,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND user_id = $2
             RETURNING *`,
            [id, userId]
        );

        if (result.rows.length === 0) {
            throw new AppError('Speech not found', 404);
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
};
