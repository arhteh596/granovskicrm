-- Extend status_buttons styling: icon + border + hover states
-- Safe to run multiple times

ALTER TABLE status_buttons
  ADD COLUMN IF NOT EXISTS icon_color VARCHAR(20) NOT NULL DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS border_color VARCHAR(20) NOT NULL DEFAULT 'transparent',
  ADD COLUMN IF NOT EXISTS border_color_hover VARCHAR(20) NOT NULL DEFAULT 'transparent';

-- Ensure existing rows are not null
UPDATE status_buttons SET icon_color = '#ffffff' WHERE icon_color IS NULL;
UPDATE status_buttons SET border_color = 'transparent' WHERE border_color IS NULL;
UPDATE status_buttons SET border_color_hover = 'transparent' WHERE border_color_hover IS NULL;
