CREATE TABLE IF NOT EXISTS reminder_permission_requests (
    id SERIAL PRIMARY KEY,
    reminder_id INTEGER NOT NULL REFERENCES delivery_reminders(id) ON DELETE CASCADE,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_production_manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_production_manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_permission JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolved_by INTEGER REFERENCES users(id),
    resolution_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_reminder_permission_requests_status
  ON reminder_permission_requests(status);


