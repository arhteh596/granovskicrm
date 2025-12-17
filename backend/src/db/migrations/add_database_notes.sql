-- Add notes field to databases table
ALTER TABLE databases ADD COLUMN IF NOT EXISTS notes TEXT;
