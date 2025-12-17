import { Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { LoginDTO, CreateUserDTO } from '../types';

// Login
export const login = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { username, password }: LoginDTO = req.body;

        console.log('Login attempt:', { username, password: '***' });

        if (!username || !password) {
            throw new AppError('Username and password are required', 400);
        }

        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1 AND is_active = true',
            [username]
        );

        console.log('User found:', result.rows.length > 0);

        if (result.rows.length === 0) {
            throw new AppError('Invalid credentials', 401);
        }

        const user = result.rows[0];
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        console.log('Password valid:', isPasswordValid);

        if (!isPasswordValid) {
            throw new AppError('Invalid credentials', 401);
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET!,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: user.role,
                avatar_url: user.avatar_url,
            },
        });
    } catch (error) {
        next(error);
    }
};

// Register (только для admin)
export const register = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        // Проверка прав администратора
        if (req.user?.role !== 'admin') {
            throw new AppError('Only administrators can create users', 403);
        }

        const { username, full_name, password, role }: CreateUserDTO = req.body;

        if (!username || !full_name || !password || !role) {
            throw new AppError('All fields are required', 400);
        }

        if (!['admin', 'manager'].includes(role)) {
            throw new AppError('Invalid role', 400);
        }

        // Проверка существования пользователя
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );

        if (existingUser.rows.length > 0) {
            throw new AppError('Username already exists', 409);
        }

        const password_hash = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (username, full_name, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, full_name, role, created_at`,
            [username, full_name, password_hash, role]
        );

        res.status(201).json({
            success: true,
            data: result.rows[0],
            message: 'User created successfully',
        });
    } catch (error) {
        next(error);
    }
};

// Get Current User
export const getCurrentUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;

        const result = await pool.query(
            `SELECT id, username, full_name, role, avatar_url, created_at
       FROM users WHERE id = $1 AND is_active = true`,
            [userId]
        );

        if (result.rows.length === 0) {
            throw new AppError('User not found', 404);
        }

        res.json({
            success: true,
            data: result.rows[0],
        });
    } catch (error) {
        next(error);
    }
};
