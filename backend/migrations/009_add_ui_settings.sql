-- UI settings: page visibility and announcements

CREATE TABLE IF NOT EXISTS page_visibility_rules (
  id SERIAL PRIMARY KEY,
  role VARCHAR(20) NOT NULL CHECK (role IN ('manager', 'zakryv')),
  page_key VARCHAR(100) NOT NULL,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role, page_key)
);

CREATE INDEX IF NOT EXISTS idx_page_visibility_role ON page_visibility_rules(role);
CREATE INDEX IF NOT EXISTS idx_page_visibility_page_key ON page_visibility_rules(page_key);

CREATE TRIGGER update_page_visibility_rules_updated_at BEFORE UPDATE ON page_visibility_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('marquee', 'popup')),
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('all', 'role', 'user')),
  target_role VARCHAR(20),
  target_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  repeat_count INTEGER DEFAULT 1,
  display_duration_ms INTEGER DEFAULT 8000,
  start_at TIMESTAMP DEFAULT NOW(),
  end_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_target ON announcements(target_type, target_role, target_user_id);

CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
