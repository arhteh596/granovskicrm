import pool from '../../config/database';
import { TelegramSession, CreateTelegramSessionDTO, SessionHistory } from '../../types';

export const telegramSessionDb = {
    async create(data: CreateTelegramSessionDTO): Promise<TelegramSession> {
        const query = `
            INSERT INTO telegram_sessions (
                phone_number, created_by, client_id, 
                client_full_name, client_birthdate, client_address
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;

        const values = [
            data.phone_number,
            data.created_by,
            data.client_id || null,
            data.client_full_name || null,
            data.client_birthdate || null,
            data.client_address || null
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    },

    async findByPhone(phoneNumber: string): Promise<TelegramSession | null> {
        const query = 'SELECT * FROM telegram_sessions WHERE phone_number = $1';
        const result = await pool.query(query, [phoneNumber]);
        return result.rows[0] || null;
    },

    async updateSessionString(phoneNumber: string, sessionString: string): Promise<void> {
        const query = `
            UPDATE telegram_sessions 
            SET session_string = $1, last_used_at = CURRENT_TIMESTAMP 
            WHERE phone_number = $2
        `;
        await pool.query(query, [sessionString, phoneNumber]);
    },

    async getAll(): Promise<TelegramSession[]> {
        const query = 'SELECT * FROM telegram_sessions ORDER BY created_at DESC';
        const result = await pool.query(query);
        return result.rows;
    },

    async getAllWithUserInfo(): Promise<any[]> {
        const query = `
            SELECT 
                ts.*,
                u.username as creator_username,
                u.full_name as creator_full_name
            FROM telegram_sessions ts
            LEFT JOIN users u ON ts.created_by = u.id
            ORDER BY ts.created_at DESC
        `;
        const result = await pool.query(query);
        return result.rows;
    },

    async getById(id: number): Promise<TelegramSession | null> {
        const query = 'SELECT * FROM telegram_sessions WHERE id = $1';
        const result = await pool.query(query, [id]);
        return result.rows[0] || null;
    },

    async updateStatus(phoneNumber: string, isActive: boolean): Promise<void> {
        const query = 'UPDATE telegram_sessions SET is_active = $1 WHERE phone_number = $2';
        await pool.query(query, [isActive, phoneNumber]);
    },

    async delete(id: number): Promise<void> {
        const query = 'DELETE FROM telegram_sessions WHERE id = $1';
        await pool.query(query, [id]);
    },

    async addHistory(sessionId: number, userId: number, action: string, details?: string): Promise<void> {
        const query = `
            INSERT INTO session_history (session_id, user_id, action, details)
            VALUES ($1, $2, $3, $4)
        `;
        await pool.query(query, [sessionId, userId, action, details]);
    },

    async getHistory(sessionId: number): Promise<SessionHistory[]> {
        const query = `
            SELECT sh.*, u.username, u.full_name
            FROM session_history sh
            LEFT JOIN users u ON sh.user_id = u.id
            WHERE sh.session_id = $1
            ORDER BY sh.created_at DESC
        `;
        const result = await pool.query(query, [sessionId]);
        return result.rows;
    }
};

export const exportsLogDb = {
    async add(sessionId: number, userId: number | undefined, action: string, fileName?: string, fileSize?: number, details?: any) {
        const query = `
            INSERT INTO exports_log (session_id, user_id, action, file_name, file_size, details)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        const values = [sessionId, userId || null, action, fileName || null, fileSize || null, details ? JSON.stringify(details) : null];
        const result = await pool.query(query, values);
        return result.rows[0];
    }
};
