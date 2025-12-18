-- Adds hover icon color to status_buttons for extended UI customization
-- Safe to run multiple times.

ALTER TABLE status_buttons
    ADD COLUMN IF NOT EXISTS icon_color_hover VARCHAR(20);

-- Backfill only once (safe for repeated runs)
UPDATE status_buttons
SET icon_color_hover = icon_color
WHERE icon_color_hover IS NULL;
