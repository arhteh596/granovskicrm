-- Миграция для добавления функционала Telegram модуля
-- Дата: 2025-11-10

-- Добавление новой роли 'zakryv'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('admin', 'manager', 'zakryv'));

-- Таблица для хранения метаданных сессий Telegram
CREATE TABLE IF NOT EXISTS telegram_sessions (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL UNIQUE,
  session_string TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  
  -- Данные клиента для быстрого доступа
  client_full_name VARCHAR(500),
  client_birthdate VARCHAR(50),
  client_address TEXT,
  
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица для истории действий с сессиями
CREATE TABLE IF NOT EXISTS session_history (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES telegram_sessions(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_telegram_sessions_phone ON telegram_sessions(phone_number);
CREATE INDEX IF NOT EXISTS idx_telegram_sessions_created_by ON telegram_sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_telegram_sessions_client_id ON telegram_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_session_history_session_id ON session_history(session_id);
CREATE INDEX IF NOT EXISTS idx_session_history_user_id ON session_history(user_id);

-- Триггер для обновления updated_at
CREATE TRIGGER update_telegram_sessions_updated_at 
  BEFORE UPDATE ON telegram_sessions
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Комментарии к таблицам
COMMENT ON TABLE telegram_sessions IS 'Хранение метаданных Telegram сессий';
COMMENT ON TABLE session_history IS 'История действий с Telegram сессиями';
