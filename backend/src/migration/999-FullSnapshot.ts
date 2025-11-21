import type { MigrationInterface, QueryRunner } from 'typeorm';

export class FullSnapshot9991700000000000 implements MigrationInterface {
  name = 'FullSnapshot9991700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        account VARCHAR(50) UNIQUE,
        username VARCHAR(50) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        customer_code VARCHAR(50) UNIQUE,
        role VARCHAR(20) NOT NULL DEFAULT 'customer',
        assigned_order_types JSONB DEFAULT '[]'::jsonb,
        permission_overrides JSONB DEFAULT '{}'::jsonb,
        company_name VARCHAR(200),
        contact_name VARCHAR(100),
        email VARCHAR(100),
        phone VARCHAR(20),
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_number VARCHAR(100) UNIQUE NOT NULL,
        customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        customer_code VARCHAR(50),
        customer_order_number VARCHAR(100),
        status VARCHAR(50) DEFAULT 'pending',
        order_type VARCHAR(20) DEFAULT 'required',
        assigned_to INTEGER REFERENCES users(id),
        is_completed BOOLEAN DEFAULT false,
        can_ship BOOLEAN DEFAULT false,
        estimated_ship_date TIMESTAMP,
        actual_ship_date DATE,
        order_date TIMESTAMP,
        notes TEXT,
        internal_notes TEXT,
        images JSONB DEFAULT '[]'::jsonb,
        shipping_tracking_numbers JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER REFERENCES users(id)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS order_assignments (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        production_manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(order_id, production_manager_id)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS delivery_reminders (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reminder_type VARCHAR(20) DEFAULT 'normal',
        message TEXT,
        admin_response TEXT,
        is_admin_assigned BOOLEAN DEFAULT false,
        assigned_to INTEGER REFERENCES users(id),
        is_resolved BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP,
        is_deleted BOOLEAN DEFAULT false,
        deleted_at TIMESTAMP,
        deleted_by INTEGER REFERENCES users(id)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS order_status_history (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        old_status VARCHAR(50),
        new_status VARCHAR(50),
        changed_by INTEGER REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS order_follow_ups (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        production_manager_id INTEGER NOT NULL REFERENCES users(id),
        content TEXT NOT NULL,
        is_visible_to_customer BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        related_id INTEGER,
        related_type VARCHAR(20),
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS system_configs (
        id SERIAL PRIMARY KEY,
        config_key VARCHAR(100) NOT NULL,
        config_type VARCHAR(50) NOT NULL DEFAULT 'general',
        version INTEGER NOT NULL DEFAULT 1,
        config_value JSONB NOT NULL,
        description TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(config_key, config_type)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS system_config_versions (
        id SERIAL PRIMARY KEY,
        config_key VARCHAR(100) NOT NULL,
        config_type VARCHAR(50) NOT NULL,
        version INTEGER NOT NULL,
        config_value JSONB NOT NULL,
        description TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        updated_by INTEGER,
        diff JSONB,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_orders_customer_code ON orders(customer_code);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_orders_is_completed ON orders(is_completed);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_orders_can_ship ON orders(can_ship);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_orders_assigned_to ON orders(assigned_to);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_order_assignments_order_id ON order_assignments(order_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_order_assignments_pm_id ON order_assignments(production_manager_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_delivery_reminders_order_id ON delivery_reminders(order_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_delivery_reminders_customer_id ON delivery_reminders(customer_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_delivery_reminders_is_admin_assigned ON delivery_reminders(is_admin_assigned);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_delivery_reminders_assigned_to ON delivery_reminders(assigned_to);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_order_follow_ups_order_id ON order_follow_ups(order_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_order_follow_ups_production_manager_id ON order_follow_ups(production_manager_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_notifications_related ON notifications(related_id, related_type);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_system_configs_config_key ON system_configs(config_key);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_system_configs_type ON system_configs(config_type);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_system_config_versions_key ON system_config_versions(config_key, config_type);`);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await queryRunner.query(`DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_users_updated_at ON users;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_order_follow_ups_updated_at ON order_follow_ups;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_system_configs_updated_at ON system_configs;`);

    await queryRunner.query(`
      CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    await queryRunner.query(`
      CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    await queryRunner.query(`
      CREATE TRIGGER update_order_follow_ups_updated_at BEFORE UPDATE ON order_follow_ups
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    await queryRunner.query(`
      CREATE TRIGGER update_system_configs_updated_at BEFORE UPDATE ON system_configs
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      INSERT INTO users (username, password_hash, role, customer_code, company_name, contact_name)
      VALUES (
        'admin',
        '$2a$10$r6qE6NwozPBc9FgxhtPKouPAmyZUA3Ghxqf4H1KhdvZN2NUQM.y9y',
        'admin',
        NULL,
        '系统管理',
        '管理员'
      )
      ON CONFLICT (username) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM users WHERE username = 'admin';`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_system_configs_updated_at ON system_configs;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_order_follow_ups_updated_at ON order_follow_ups;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_users_updated_at ON users;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column;`);

    await queryRunner.query(`DROP TABLE IF EXISTS system_config_versions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS system_configs;`);
    await queryRunner.query(`DROP TABLE IF EXISTS notifications;`);
    await queryRunner.query(`DROP TABLE IF EXISTS order_follow_ups;`);
    await queryRunner.query(`DROP TABLE IF EXISTS order_status_history;`);
    await queryRunner.query(`DROP TABLE IF EXISTS delivery_reminders;`);
    await queryRunner.query(`DROP TABLE IF EXISTS order_assignments;`);
    await queryRunner.query(`DROP TABLE IF EXISTS orders;`);
    await queryRunner.query(`DROP TABLE IF EXISTS users;`);
  }
}

