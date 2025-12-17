-- Добавление полей для перезвонов и передачи клиентов
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS callback_datetime TIMESTAMP,
ADD COLUMN IF NOT EXISTS callback_notes TEXT,
ADD COLUMN IF NOT EXISTS transferred_notes TEXT;

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_clients_callback_datetime ON clients(callback_datetime);
CREATE INDEX IF NOT EXISTS idx_clients_transferred_to ON clients(transferred_to);
