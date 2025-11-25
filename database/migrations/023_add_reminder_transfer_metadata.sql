ALTER TABLE delivery_reminders
  ADD COLUMN IF NOT EXISTS last_transferred_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_transferred_by INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS last_transferred_to INTEGER REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_delivery_reminders_last_transfer
  ON delivery_reminders(last_transferred_at);

