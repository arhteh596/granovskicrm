-- Добавление таблицы для спичей (шаблонов разговоров)

CREATE TABLE IF NOT EXISTS speeches (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_speeches_user_id ON speeches(user_id);
CREATE INDEX IF NOT EXISTS idx_speeches_favorite ON speeches(is_favorite);

-- Триггер для обновления updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_speeches_updated_at') THEN
    CREATE TRIGGER update_speeches_updated_at BEFORE UPDATE ON speeches
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
