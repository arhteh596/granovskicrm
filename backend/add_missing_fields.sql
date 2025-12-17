-- Add callback fields to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS callback_datetime TIMESTAMP;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS callback_notes TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS transferred_notes TEXT;