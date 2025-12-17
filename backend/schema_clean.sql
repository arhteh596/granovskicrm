-- CRM Calls Database Schema
-- PostgreSQL Database

-- ======================================
-- 1. USERS TABLE
-- ======================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager')),
  avatar_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ======================================
-- 2. DATABASES TABLE (CSV Uploads)
-- ======================================
CREATE TABLE IF NOT EXISTS databases (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total_clients INTEGER DEFAULT 0,
  assigned_clients INTEGER DEFAULT 0,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ======================================
-- 3. CLIENTS TABLE
-- ======================================
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  database_id INTEGER REFERENCES databases(id) ON DELETE CASCADE,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  
  -- CSV Data Fields (based on report2_depsearch.csv)
  ceo_name VARCHAR(500),
  company_name VARCHAR(500),
  company_inn VARCHAR(50),
  postal_code VARCHAR(20),
  region VARCHAR(255),
  address_rest TEXT,
  authorized_capital VARCHAR(255),
  main_activity TEXT,
  source_url TEXT,
  
  -- Phone Numbers
  phone VARCHAR(50),
  phone_data TEXT,
  phone1 VARCHAR(50),
  phone1_data TEXT,
  phone2 VARCHAR(50),
  phone2_data TEXT,
  phone3 VARCHAR(50),
  phone3_data TEXT,
  
  -- Addresses
  address TEXT,
  address_data TEXT,
  address1 TEXT,
  address1_data TEXT,
  address2 TEXT,
  address2_data TEXT,
  address3 TEXT,
  address3_data TEXT,
  address4 TEXT,
  address4_data TEXT,
  
  -- Emails
  email VARCHAR(255),
  email_data TEXT,
  email1 VARCHAR(255),
  email1_data TEXT,
  email2 VARCHAR(255),
  email2_data TEXT,
  email3 VARCHAR(255),
  email3_data TEXT,
  email4 VARCHAR(255),
  email4_data TEXT,
  
  -- Additional Data
  passport TEXT,
  passport_data TEXT,
  birthdate VARCHAR(50),
  birthdate_data TEXT,
  snils VARCHAR(50),
  snils_data TEXT,
  inn VARCHAR(50),
  inn_data TEXT,
  vehicles TEXT,
  social TEXT,
  relatives TEXT,
  tags TEXT,
  
  -- Call Status (8 statuses)
  call_status VARCHAR(50) CHECK (call_status IN (
    'не дозвон', 
    'автоответчик', 
    'питон', 
    'срез', 
    'другой человек', 
    'перезвон', 
    'передать', 
    'взял код',
    NULL
  )),
  
  -- Transfer to another manager
  transferred_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  transfer_date TIMESTAMP,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ======================================
-- 4. CALL HISTORY TABLE
-- ======================================
CREATE TABLE IF NOT EXISTS call_history (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  call_status VARCHAR(50) NOT NULL,
  call_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  duration INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ======================================
-- 5. CLIENT NOTES TABLE
-- ======================================
CREATE TABLE IF NOT EXISTS client_notes (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  note_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ======================================
-- 6. CALL FILTERS TABLE
-- ======================================
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

-- ======================================
-- 7. INDEXES
-- ======================================
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_clients_assigned_to ON clients(assigned_to);
CREATE INDEX IF NOT EXISTS idx_clients_database_id ON clients(database_id);
CREATE INDEX IF NOT EXISTS idx_clients_call_status ON clients(call_status);
CREATE INDEX IF NOT EXISTS idx_call_history_client_id ON call_history(client_id);
CREATE INDEX IF NOT EXISTS idx_call_history_user_id ON call_history(user_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_client_id ON client_notes(client_id);
CREATE INDEX IF NOT EXISTS idx_call_filters_created_by ON call_filters(created_by);

-- ======================================
-- 8. UPDATED_AT TRIGGER FUNCTION
-- ======================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_notes_updated_at BEFORE UPDATE ON client_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_call_filters_updated_at BEFORE UPDATE ON call_filters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ======================================
-- 9. DEFAULT ADMIN USER
-- username: admin
-- password: admin123
-- Password hash generated with bcrypt (10 rounds): $2b$10$XqAQO8F.q9vZZxh8r2eMWO5Y4MXY7VaJ4h7L.JeD.q8H2pKjVxO8e
-- ======================================
INSERT INTO users (username, full_name, password_hash, role) 
VALUES ('admin', 'Main Administrator', '$2b$10$XqAQO8F.q9vZZxh8r2eMWO5Y4MXY7VaJ4h7L.JeD.q8H2pKjVxO8e', 'admin')
ON CONFLICT (username) DO NOTHING;