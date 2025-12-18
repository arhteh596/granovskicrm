-- Adds return_priority flag to prioritize clients returned to work
ALTER TABLE clients ADD COLUMN IF NOT EXISTS return_priority BOOLEAN DEFAULT false;
