-- Adds is_wiki flags to databases and clients to decouple Wiki data
ALTER TABLE IF EXISTS databases ADD COLUMN IF NOT EXISTS is_wiki BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE IF EXISTS clients ADD COLUMN IF NOT EXISTS is_wiki BOOLEAN NOT NULL DEFAULT false;
