import 'reflect-metadata';
import path from 'path';
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';

// 默认加载项目根目录下的 .env
const envPath = process.env.ENV_FILE_PATH || path.resolve(process.cwd(), '../.env');
dotenv.config({ path: envPath });

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'fangdu_db',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  synchronize: false,
  logging: process.env.TYPEORM_LOGGING === 'true',
  migrationsTableName: process.env.TYPEORM_MIGRATIONS_TABLE || 'migrations',
  entities: [],
  migrations: ['src/migration/*.ts'],
  subscribers: [],
});

