-- Adds configurable status buttons and layout settings for call/wiki pages
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
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_status_layout_settings_updated_at'
    ) THEN
        CREATE TRIGGER update_status_layout_settings_updated_at
        BEFORE UPDATE ON status_layout_settings
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Defaults
INSERT INTO status_layout_settings(page, columns) VALUES
    ('call', 4),
    ('wiki', 4)
ON CONFLICT (page) DO NOTHING;

INSERT INTO status_buttons(page, label, status_value, color, action, position) VALUES
    ('call', 'не дозвон', 'не дозвон', '#4b5563', 'set-status', 1),
    ('call', 'автоответчик', 'автоответчик', '#2563eb', 'set-status', 2),
    ('call', 'питон', 'питон', '#d97706', 'set-status', 3),
    ('call', 'срез', 'срез', '#dc2626', 'set-status', 4),
    ('call', 'другой человек', 'другой человек', '#7c3aed', 'set-status', 5),
    ('call', 'перезвон', 'перезвон', '#0ea5e9', 'callback', 6),
    ('call', 'передать', 'передать', '#d4af37', 'transfer', 7),
    ('call', 'взял код', 'взял код', '#059669', 'set-status', 8),
    ('wiki', 'не дозвон', 'не дозвон', '#4b5563', 'set-status', 1),
    ('wiki', 'автоответчик', 'автоответчик', '#2563eb', 'set-status', 2),
    ('wiki', 'питон', 'питон', '#d97706', 'set-status', 3),
    ('wiki', 'срез', 'срез', '#dc2626', 'set-status', 4),
    ('wiki', 'другой человек', 'другой человек', '#7c3aed', 'set-status', 5),
    ('wiki', 'перезвон', 'перезвон', '#0ea5e9', 'callback', 6),
    ('wiki', 'передать', 'передать', '#d4af37', 'transfer', 7),
    ('wiki', 'взял код', 'взял код', '#059669', 'set-status', 8)
ON CONFLICT (page, status_value) DO NOTHING;
