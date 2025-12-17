-- Миграция: Добавление таблицы фильтров для звонков
-- Дата: 2025-11-03

CREATE TABLE IF NOT EXISTS call_filters (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  database_ids INTEGER[] NOT NULL,
  user_ids INTEGER[],
  statuses VARCHAR(50)[],
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_call_filters_created_by ON call_filters(created_by);

CREATE TRIGGER update_call_filters_updated_at BEFORE UPDATE ON call_filters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
