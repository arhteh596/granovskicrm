import { Response } from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { User, CreateUserDTO, UpdateUserDTO } from '../types';

/**
 * Получить всех пользователей
 * @route GET /api/users
 * @access Admin only
 */
export const getAllUsers = async (req: AuthRequest, res: Response) => {
    const result = await pool.query<User>(
        'SELECT id, username, full_name, role, avatar_url, created_at, updated_at FROM users ORDER BY created_at DESC'
    );

    res.json({
        success: true,
        data: result.rows
    });
};

/**
 * Получить пользователя по ID
 * @route GET /api/users/:id
 * @access Admin only
 */
export const getUserById = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const result = await pool.query<User>(
        'SELECT id, username, full_name, role, avatar_url, created_at, updated_at FROM users WHERE id = $1',
        [id]
    );

    if (result.rows.length === 0) {
        throw new AppError('Пользователь не найден', 404);
    }

    res.json({
        success: true,
        data: result.rows[0]
    });
};

/**
 * Создать нового пользователя
 * @route POST /api/users
 * @access Admin only
 */
export const createUser = async (req: AuthRequest, res: Response) => {
    const { username, password, full_name, role }: CreateUserDTO = req.body;

    // Валидация
    if (!username || !password) {
        throw new AppError('Требуется логин и пароль', 400);
    }

    if (!full_name) {
        throw new AppError('Требуется полное имя', 400);
    }

    if (password.length < 6) {
        throw new AppError('Пароль должен содержать минимум 6 символов', 400);
    }

    if (!['admin', 'manager'].includes(role)) {
        throw new AppError('Роль должна быть admin или manager', 400);
    }

    // Проверка на дубликаты
    const existingUser = await pool.query(
        'SELECT id FROM users WHERE username = $1',
        [username]
    );

    if (existingUser.rows.length > 0) {
        throw new AppError('Пользователь с таким логином уже существует', 400);
    }

    // Хеширование пароля
    const passwordHash = await bcrypt.hash(password, 10);

    // Создание пользователя
    const result = await pool.query<User>(
        `INSERT INTO users (username, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, full_name, role, avatar_url, created_at`,
        [username, passwordHash, full_name, role]
    );

    res.status(201).json({
        success: true,
        data: result.rows[0],
        message: 'Пользователь успешно создан'
    });
};

/**
 * Обновить пользователя
 * @route PUT /api/users/:id
 * @access Admin only
 */
export const updateUser = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { username, password, role, avatar_url }: UpdateUserDTO = req.body;

    // Проверка существования
    const existingUser = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (existingUser.rows.length === 0) {
        throw new AppError('Пользователь не найден', 404);
    }

    // Проверка уникальности username
    if (username) {
        const duplicateCheck = await pool.query(
            'SELECT id FROM users WHERE username = $1 AND id != $2',
            [username, id]
        );
        if (duplicateCheck.rows.length > 0) {
            throw new AppError('Пользователь с таким логином уже существует', 400);
        }
    }

    // Валидация роли
    if (role && !['admin', 'manager'].includes(role)) {
        throw new AppError('Роль должна быть admin или manager', 400);
    }

    // Подготовка обновлений
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (username) {
        updates.push(`username = $${paramIndex++}`);
        values.push(username);
    }

    if (password) {
        if (password.length < 6) {
            throw new AppError('Пароль должен содержать минимум 6 символов', 400);
        }
        const passwordHash = await bcrypt.hash(password, 10);
        updates.push(`password_hash = $${paramIndex++}`);
        values.push(passwordHash);
    }

    if (role) {
        updates.push(`role = $${paramIndex++}`);
        values.push(role);
    }

    if (avatar_url !== undefined) {
        updates.push(`avatar_url = $${paramIndex++}`);
        values.push(avatar_url);
    }

    if (updates.length === 0) {
        throw new AppError('Нет данных для обновления', 400);
    }

    values.push(id);

    const result = await pool.query<User>(
        `UPDATE users SET ${updates.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING id, username, full_name, role, avatar_url, created_at, updated_at`,
        values
    );

    res.json({
        success: true,
        data: result.rows[0],
        message: 'Пользователь успешно обновлён'
    });
};

/**
 * Удалить пользователя
 * @route DELETE /api/users/:id
 * @access Admin only
 */
export const deleteUser = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    // Нельзя удалить самого себя
    if (req.user?.id === parseInt(id)) {
        throw new AppError('Нельзя удалить самого себя', 400);
    }

    // Проверка существования
    const existingUser = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (existingUser.rows.length === 0) {
        throw new AppError('Пользователь не найден', 404);
    }

    // Удаление
    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    res.json({
        success: true,
        message: 'Пользователь успешно удалён'
    });
};

/**
 * Обновить аватар пользователя
 * @route PATCH /api/users/:id/avatar
 * @access Admin or self
 */
export const updateAvatar = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { avatar_url } = req.body;

    // Проверка прав: только админ или сам пользователь
    if (req.user?.role !== 'admin' && req.user?.id !== parseInt(id)) {
        throw new AppError('Недостаточно прав', 403);
    }

    if (!avatar_url) {
        throw new AppError('Требуется URL аватара', 400);
    }

    const result = await pool.query<User>(
        `UPDATE users SET avatar_url = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, username, full_name, role, avatar_url, created_at, updated_at`,
        [avatar_url, id]
    );

    if (result.rows.length === 0) {
        throw new AppError('Пользователь не найден', 404);
    }

    res.json({
        success: true,
        data: result.rows[0],
        message: 'Аватар успешно обновлён'
    });
};

/**
 * Загрузить аватар пользователя (файл)
 * @route POST /api/users/:id/avatar/upload
 * @access Admin or self
 */
export const uploadAvatar = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    // Проверка прав: только админ или сам пользователь
    if (req.user?.role !== 'admin' && req.user?.id !== parseInt(id)) {
        throw new AppError('Недостаточно прав', 403);
    }

    if (!req.file) {
        throw new AppError('Файл не загружен', 400);
    }

    // Формируем URL аватара
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    console.log(`[uploadAvatar] Uploading avatar for user ${id}, file: ${req.file.filename}, path: ${avatarUrl}`);

    const result = await pool.query<User>(
        `UPDATE users SET avatar_url = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, username, full_name, role, avatar_url, created_at, updated_at`,
        [avatarUrl, id]
    );

    if (result.rows.length === 0) {
        throw new AppError('Пользователь не найден', 404);
    }

    console.log(`[uploadAvatar] Avatar uploaded successfully:`, result.rows[0]);

    res.json({
        success: true,
        data: result.rows[0],
        message: 'Аватар успешно загружен'
    });
};
