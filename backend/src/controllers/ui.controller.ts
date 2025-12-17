import { Response } from 'express';
import pool from '../config/database';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthRequest } from '../middleware/auth.middleware';

const allowedRoles = ['manager', 'zakryv'];
const allowedPageKeys = ['call', 'wiki', 'statistics', 'profile', 'mamonty', 'katka'];
const statusPages = ['call', 'wiki'];
const statusActions = ['set-status', 'callback', 'transfer'];

const defaultStatusButtons = [
    // Call
    { page: 'call', label: 'не дозвон', status_value: 'не дозвон', color: '#4b5563', color_active: '#374151', icon: 'phone-missed', action: 'set-status', position: 1 },
    { page: 'call', label: 'автоответчик', status_value: 'автоответчик', color: '#2563eb', color_active: '#1d4ed8', icon: 'voicemail', action: 'set-status', position: 2 },
    { page: 'call', label: 'питон', status_value: 'питон', color: '#d97706', color_active: '#b45309', icon: 'bot', action: 'set-status', position: 3 },
    { page: 'call', label: 'срез', status_value: 'срез', color: '#dc2626', color_active: '#b91c1c', icon: 'alert-circle', action: 'set-status', position: 4 },
    { page: 'call', label: 'другой человек', status_value: 'другой человек', color: '#7c3aed', color_active: '#6d28d9', icon: 'user-x', action: 'set-status', position: 5 },
    { page: 'call', label: 'перезвон', status_value: 'перезвон', color: '#0ea5e9', color_active: '#0284c7', icon: 'phone-forwarded', action: 'callback', position: 6 },
    { page: 'call', label: 'передать', status_value: 'передать', color: '#d4af37', color_active: '#c59f24', icon: 'user-plus', action: 'transfer', position: 7 },
    { page: 'call', label: 'взял код', status_value: 'взял код', color: '#059669', color_active: '#047857', icon: 'check-circle-2', action: 'set-status', position: 8 },
    // Wiki defaults mirror call
    { page: 'wiki', label: 'не дозвон', status_value: 'не дозвон', color: '#4b5563', color_active: '#374151', icon: 'phone-missed', action: 'set-status', position: 1 },
    { page: 'wiki', label: 'автоответчик', status_value: 'автоответчик', color: '#2563eb', color_active: '#1d4ed8', icon: 'voicemail', action: 'set-status', position: 2 },
    { page: 'wiki', label: 'питон', status_value: 'питон', color: '#d97706', color_active: '#b45309', icon: 'bot', action: 'set-status', position: 3 },
    { page: 'wiki', label: 'срез', status_value: 'срез', color: '#dc2626', color_active: '#b91c1c', icon: 'alert-circle', action: 'set-status', position: 4 },
    { page: 'wiki', label: 'другой человек', status_value: 'другой человек', color: '#7c3aed', color_active: '#6d28d9', icon: 'user-x', action: 'set-status', position: 5 },
    { page: 'wiki', label: 'перезвон', status_value: 'перезвон', color: '#0ea5e9', color_active: '#0284c7', icon: 'phone-forwarded', action: 'callback', position: 6 },
    { page: 'wiki', label: 'передать', status_value: 'передать', color: '#d4af37', color_active: '#c59f24', icon: 'user-plus', action: 'transfer', position: 7 },
    { page: 'wiki', label: 'взял код', status_value: 'взял код', color: '#059669', color_active: '#047857', icon: 'check-circle-2', action: 'set-status', position: 8 }
];

const defaultStatusLayouts: Record<string, number> = {
    call: 4,
    wiki: 4
};

let tablesInitialized = false;

const ensureUiTables = async () => {
    if (tablesInitialized) return;

    await pool.query(`
        CREATE TABLE IF NOT EXISTS page_visibility_rules (
            id SERIAL PRIMARY KEY,
            role VARCHAR(20) NOT NULL,
            page_key VARCHAR(100) NOT NULL,
            visible BOOLEAN NOT NULL DEFAULT true,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT page_visibility_role_check CHECK (role IN ('manager', 'zakryv')),
            UNIQUE(role, page_key)
        );
        CREATE INDEX IF NOT EXISTS idx_page_visibility_role ON page_visibility_rules(role);
        CREATE INDEX IF NOT EXISTS idx_page_visibility_page_key ON page_visibility_rules(page_key);
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_trigger WHERE tgname = 'update_page_visibility_rules_updated_at'
            ) THEN
                CREATE TRIGGER update_page_visibility_rules_updated_at
                BEFORE UPDATE ON page_visibility_rules
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            END IF;
        END $$;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS announcements (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            type VARCHAR(20) NOT NULL CHECK (type IN ('marquee', 'popup')),
            target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('all', 'role', 'user')),
            target_role VARCHAR(20),
            target_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            repeat_count INTEGER DEFAULT 1,
            display_duration_ms INTEGER DEFAULT 8000,
            start_at TIMESTAMP DEFAULT NOW(),
            end_at TIMESTAMP,
            is_active BOOLEAN DEFAULT true,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active);
        CREATE INDEX IF NOT EXISTS idx_announcements_target ON announcements(target_type, target_role, target_user_id);
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_trigger WHERE tgname = 'update_announcements_updated_at'
            ) THEN
                CREATE TRIGGER update_announcements_updated_at
                BEFORE UPDATE ON announcements
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            END IF;
        END $$;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS status_layout_settings (
            page VARCHAR(50) PRIMARY KEY,
            columns SMALLINT NOT NULL DEFAULT 4,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT status_layout_columns_check CHECK (columns BETWEEN 2 AND 4),
            CONSTRAINT status_layout_page_check CHECK (page IN ('call', 'wiki'))
        );
        CREATE TABLE IF NOT EXISTS status_buttons (
            id SERIAL PRIMARY KEY,
            page VARCHAR(50) NOT NULL,
            label VARCHAR(100) NOT NULL,
            status_value VARCHAR(100) NOT NULL,
            color VARCHAR(20) NOT NULL DEFAULT '#2563eb',
            color_active VARCHAR(20) NOT NULL DEFAULT '#1d4ed8',
            icon VARCHAR(50) NOT NULL DEFAULT 'check-circle-2',
            action VARCHAR(20) NOT NULL DEFAULT 'set-status',
            position INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT status_buttons_page_check CHECK (page IN ('call', 'wiki')),
            CONSTRAINT status_buttons_action_check CHECK (action IN ('set-status', 'callback', 'transfer')),
            UNIQUE(page, status_value)
        );
        CREATE INDEX IF NOT EXISTS idx_status_buttons_page_position ON status_buttons(page, position);
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_trigger WHERE tgname = 'update_status_buttons_updated_at'
            ) THEN
                CREATE TRIGGER update_status_buttons_updated_at
                BEFORE UPDATE ON status_buttons
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            END IF;
        END $$;
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_trigger WHERE tgname = 'update_status_layout_settings_updated_at'
            ) THEN
                CREATE TRIGGER update_status_layout_settings_updated_at
                BEFORE UPDATE ON status_layout_settings
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            END IF;
        END $$;
    `);

    const layoutCount = await pool.query('SELECT COUNT(*) FROM status_layout_settings');
    if (Number(layoutCount.rows[0]?.count || 0) === 0) {
        const values = Object.entries(defaultStatusLayouts)
            .map(([page, columns]) => `('${page}', ${columns})`)
            .join(',');
        await pool.query(`INSERT INTO status_layout_settings(page, columns) VALUES ${values}`);
    }

    // Ensure new columns exist for icons and active colors
    await pool.query(`
        ALTER TABLE status_buttons ADD COLUMN IF NOT EXISTS color_active VARCHAR(20) NOT NULL DEFAULT '#1d4ed8';
        ALTER TABLE status_buttons ADD COLUMN IF NOT EXISTS icon VARCHAR(50) NOT NULL DEFAULT 'check-circle-2';
    `);

    const buttonsCount = await pool.query('SELECT COUNT(*) FROM status_buttons');
    if (Number(buttonsCount.rows[0]?.count || 0) === 0) {
        const values = defaultStatusButtons
            .map((btn) => `('${btn.page}', '${btn.label}', '${btn.status_value}', '${btn.color}', '${btn.color_active}', '${btn.icon}', '${btn.action}', ${btn.position})`)
            .join(',');
        await pool.query(`
            INSERT INTO status_buttons(page, label, status_value, color, color_active, icon, action, position)
            VALUES ${values}
            ON CONFLICT (page, status_value) DO NOTHING;
            UPDATE status_buttons SET color_active = '#1d4ed8' WHERE color_active IS NULL;
            UPDATE status_buttons SET icon = 'check-circle-2' WHERE icon IS NULL;
        `);
    }

    tablesInitialized = true;
};

const validatePagePayload = (role: string, pageKey: string) => {
    if (!allowedRoles.includes(role)) {
        throw new Error('Недопустимая роль для управления видимостью');
    }
    if (!allowedPageKeys.includes(pageKey)) {
        throw new Error('Недопустимый ключ страницы');
    }
};

const validateStatusPayload = (page: string, action: string) => {
    if (!statusPages.includes(page)) {
        throw new Error('Недопустимая страница для статусов');
    }
    if (!statusActions.includes(action)) {
        throw new Error('Недопустимый тип действия статуса');
    }
};

export const getMyPageVisibility = asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureUiTables();
    const role = req.user?.role;

    if (!role) {
        return res.status(400).json({ success: false, message: 'Не удалось определить роль пользователя' });
    }

    if (role === 'admin') {
        return res.json({ role, rules: [] });
    }

    const result = await pool.query(
        'SELECT role, page_key, visible FROM page_visibility_rules WHERE role = $1',
        [role]
    );

    res.json({ role, rules: result.rows });
});

export const getAllPageVisibility = asyncHandler(async (_req: AuthRequest, res: Response) => {
    await ensureUiTables();
    const result = await pool.query(
        'SELECT role, page_key, visible FROM page_visibility_rules ORDER BY role, page_key'
    );

    res.json({ rules: result.rows });
});

export const upsertPageVisibility = asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureUiTables();
    const { role, page_key, visible } = req.body as { role: string; page_key: string; visible: boolean };
    const userId = req.user?.id || null;

    validatePagePayload(role, page_key);

    const result = await pool.query(
        `INSERT INTO page_visibility_rules (role, page_key, visible, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $4)
         ON CONFLICT (role, page_key)
         DO UPDATE SET visible = EXCLUDED.visible, updated_by = $4, updated_at = NOW()
         RETURNING role, page_key, visible`,
        [role, page_key, !!visible, userId]
    );

    res.json({ success: true, rule: result.rows[0] });
});

export const listAnnouncements = asyncHandler(async (_req: AuthRequest, res: Response) => {
    await ensureUiTables();
    const result = await pool.query(
        'SELECT * FROM announcements ORDER BY created_at DESC'
    );
    res.json({ items: result.rows });
});

export const getActiveAnnouncements = asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureUiTables();
    const userId = req.user?.id || null;
    const userRole = req.user?.role || null;

    const result = await pool.query(
        `SELECT *
         FROM announcements
         WHERE is_active = true
           AND (start_at IS NULL OR start_at <= NOW())
           AND (end_at IS NULL OR end_at >= NOW())
           AND (
                target_type = 'all'
             OR (target_type = 'role' AND target_role = $1)
             OR (target_type = 'user' AND target_user_id = $2)
           )
         ORDER BY created_at DESC`,
        [userRole, userId]
    );

    res.json({ items: result.rows });
});

export const createAnnouncement = asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureUiTables();
    const {
        title,
        message,
        type,
        target_type,
        target_role,
        target_user_id,
        repeat_count,
        display_duration_ms,
        start_at,
        end_at,
        is_active
    } = req.body;
    const userId = req.user?.id || null;

    if (!title || !message) {
        return res.status(400).json({ success: false, message: 'Заполните заголовок и текст объявления' });
    }
    if (!['marquee', 'popup'].includes(type)) {
        return res.status(400).json({ success: false, message: 'Неверный тип объявления' });
    }
    if (!['all', 'role', 'user'].includes(target_type)) {
        return res.status(400).json({ success: false, message: 'Неверный тип назначения' });
    }
    if (target_type === 'role' && !allowedRoles.includes(target_role)) {
        return res.status(400).json({ success: false, message: 'Неверная роль для назначения' });
    }
    if (target_type === 'user' && !target_user_id) {
        return res.status(400).json({ success: false, message: 'Укажите пользователя для назначения' });
    }

    const result = await pool.query(
        `INSERT INTO announcements (
            title, message, type, target_type, target_role, target_user_id,
            repeat_count, display_duration_ms, start_at, end_at, is_active,
            created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, true), $12, $12)
        RETURNING *`,
        [
            title,
            message,
            type,
            target_type,
            target_role || null,
            target_user_id || null,
            repeat_count ?? 1,
            display_duration_ms ?? 8000,
            start_at || new Date(),
            end_at || null,
            is_active,
            userId
        ]
    );

    res.status(201).json({ success: true, item: result.rows[0] });
});

export const updateAnnouncement = asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureUiTables();
    const { id } = req.params;
    const {
        title,
        message,
        type,
        target_type,
        target_role,
        target_user_id,
        repeat_count,
        display_duration_ms,
        start_at,
        end_at,
        is_active
    } = req.body;
    const userId = req.user?.id || null;

    const result = await pool.query(
        `UPDATE announcements SET
            title = COALESCE($1, title),
            message = COALESCE($2, message),
            type = COALESCE($3, type),
            target_type = COALESCE($4, target_type),
            target_role = $5,
            target_user_id = $6,
            repeat_count = COALESCE($7, repeat_count),
            display_duration_ms = COALESCE($8, display_duration_ms),
            start_at = COALESCE($9, start_at),
            end_at = $10,
            is_active = COALESCE($11, is_active),
            updated_by = $12,
            updated_at = NOW()
         WHERE id = $13
         RETURNING *`,
        [
            title,
            message,
            type,
            target_type,
            target_role || null,
            target_user_id || null,
            repeat_count,
            display_duration_ms,
            start_at,
            end_at || null,
            typeof is_active === 'boolean' ? is_active : null,
            userId,
            id
        ]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Объявление не найдено' });
    }

    res.json({ success: true, item: result.rows[0] });
});

export const setAnnouncementStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureUiTables();
    const { id } = req.params;
    const { is_active } = req.body as { is_active: boolean };
    const userId = req.user?.id || null;

    const result = await pool.query(
        `UPDATE announcements
         SET is_active = $1, updated_by = $2, updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [!!is_active, userId, id]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Объявление не найдено' });
    }

    res.json({ success: true, item: result.rows[0] });
});

export const deleteAnnouncement = asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureUiTables();
    const { id } = req.params;

    const result = await pool.query('DELETE FROM announcements WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Объявление не найдено' });
    }

    res.json({ success: true, message: 'Объявление удалено' });
});

export const getStatusButtons = asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureUiTables();
    const page = (req.query.page as string) || 'call';

    if (!statusPages.includes(page)) {
        return res.status(400).json({ success: false, message: 'Некорректная страница' });
    }

    const [buttons, layout] = await Promise.all([
        pool.query('SELECT * FROM status_buttons WHERE page = $1 AND is_active = true ORDER BY position ASC, id ASC', [page]),
        pool.query('SELECT columns FROM status_layout_settings WHERE page = $1 LIMIT 1', [page])
    ]);

    res.json({
        success: true,
        buttons: buttons.rows,
        columns: layout.rows[0]?.columns || defaultStatusLayouts[page] || 4
    });
});

export const createStatusButton = asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureUiTables();
    const { page, label, status_value, color, color_active, icon, action = 'set-status', position } = req.body as {
        page: string;
        label: string;
        status_value?: string;
        color?: string;
        color_active?: string;
        icon?: string;
        action?: string;
        position?: number;
    };
    const userId = req.user?.id || null;

    if (!label) {
        return res.status(400).json({ success: false, message: 'Укажите название кнопки' });
    }

    const trimmedPage = (page || '').trim().toLowerCase();
    const trimmedLabel = label.trim();
    const trimmedValue = (status_value || label).trim();
    const normalizedAction = (action || 'set-status').trim().toLowerCase();
    const normalizedIcon = (icon || 'check-circle-2').trim();
    const activeColor = (color_active || color || '#2563eb').trim();

    try {
        validateStatusPayload(trimmedPage, normalizedAction);
    } catch (error: any) {
        return res.status(400).json({ success: false, message: error.message });
    }

    const nextPosition = Number.isFinite(position)
        ? Number(position)
        : Number((await pool.query('SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM status_buttons WHERE page = $1', [trimmedPage])).rows[0]?.pos || 0);

    const result = await pool.query(
          `INSERT INTO status_buttons(page, label, status_value, color, color_active, icon, action, position, created_by, updated_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
         ON CONFLICT (page, status_value) DO UPDATE SET
            label = EXCLUDED.label,
            color = EXCLUDED.color,
                color_active = EXCLUDED.color_active,
                icon = EXCLUDED.icon,
            action = EXCLUDED.action,
            position = EXCLUDED.position,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW()
         RETURNING *`,
          [trimmedPage, trimmedLabel, trimmedValue, color || '#2563eb', activeColor, normalizedIcon, normalizedAction, nextPosition, userId]
    );

    res.status(201).json({ success: true, button: result.rows[0] });
});

export const updateStatusButton = asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureUiTables();
    const { id } = req.params;
    const { page, label, status_value, color, color_active, icon, action, position } = req.body as {
        page?: string;
        label?: string;
        status_value?: string;
        color?: string;
        color_active?: string;
        icon?: string;
        action?: string;
        position?: number;
    };
    const userId = req.user?.id || null;

    const existing = await pool.query('SELECT * FROM status_buttons WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Кнопка не найдена' });
    }

    const current = existing.rows[0];
    const nextPage = (page || current.page).trim().toLowerCase();
    const nextAction = (action || current.action).trim().toLowerCase();

    try {
        validateStatusPayload(nextPage, nextAction);
    } catch (error: any) {
        return res.status(400).json({ success: false, message: error.message });
    }

    const result = await pool.query(
        `UPDATE status_buttons SET
            page = $1,
            label = COALESCE($2, label),
            status_value = COALESCE($3, status_value),
            color = COALESCE($4, color),
            color_active = COALESCE($5, color_active),
            icon = COALESCE($6, icon),
            action = $7,
            position = COALESCE($8, position),
            updated_by = $9,
            updated_at = NOW()
         WHERE id = $10
         RETURNING *`,
        [
            nextPage,
            label ? label.trim() : null,
            status_value ? status_value.trim() : null,
            color || null,
            color_active || null,
            icon || null,
            nextAction,
            Number.isFinite(position) ? Number(position) : null,
            userId,
            id
        ]
    );

    res.json({ success: true, button: result.rows[0] });
});

export const deleteStatusButton = asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureUiTables();
    const { id } = req.params;

    const result = await pool.query('DELETE FROM status_buttons WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Кнопка не найдена' });
    }

    res.json({ success: true, message: 'Кнопка удалена' });
});

export const updateStatusLayout = asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureUiTables();
    const { page } = req.params;
    const { columns } = req.body as { columns: number };

    if (!statusPages.includes(page)) {
        return res.status(400).json({ success: false, message: 'Некорректная страница' });
    }

    const cols = Number(columns);
    if (!Number.isFinite(cols) || cols < 2 || cols > 4) {
        return res.status(400).json({ success: false, message: 'Колонок должно быть от 2 до 4' });
    }

    const result = await pool.query(
        `INSERT INTO status_layout_settings(page, columns)
         VALUES ($1, $2)
         ON CONFLICT (page) DO UPDATE SET columns = EXCLUDED.columns, updated_at = NOW()
         RETURNING *`,
        [page, cols]
    );

    res.json({ success: true, layout: result.rows[0] });
});
