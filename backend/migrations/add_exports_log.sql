-- Лог экспортов Telegram данных
-- Дата: 2025-11-11

CREATE TABLE IF NOT EXISTS exports_log (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES telegram_sessions(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL, -- e.g. CONTACTS_EXPORT, CHATS_EXPORT, DIALOG_EXPORT, SAVED_EXPORT
  file_name VARCHAR(1000),
  file_size BIGINT,
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exports_log_session_id ON exports_log(session_id);
CREATE INDEX IF NOT EXISTS idx_exports_log_user_id ON exports_log(user_id);
CREATE INDEX IF NOT EXISTS idx_exports_log_action ON exports_log(action);
