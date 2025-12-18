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