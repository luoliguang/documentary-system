import { Request, Response } from 'express';
import { pool } from '../config/database.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateToken } from '../utils/jwt.js';
import { AuthRequest } from '../middleware/auth.js';

// 用户登录
export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    // 查询用户
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND is_active = true',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const user = result.rows[0];

    // 验证密码
    const isValidPassword = await comparePassword(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 生成JWT token
    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      customer_code: user.customer_code || undefined,
    });

    // 返回用户信息（不包含密码）
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      message: '登录成功',
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 获取当前用户信息
export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    const result = await pool.query(
      'SELECT id, username, customer_code, role, company_name, contact_name, email, phone, created_at, updated_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 管理员创建客户账号
export const createCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const {
      username,
      password,
      customer_code,
      company_name,
      contact_name,
      email,
      phone,
    } = req.body;

    if (!username || !password || !customer_code) {
      return res
        .status(400)
        .json({ error: '用户名、密码和客户编号不能为空' });
    }

    // 检查用户名是否已存在
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    // 检查客户编号是否已存在
    const existingCode = await pool.query(
      'SELECT id FROM users WHERE customer_code = $1',
      [customer_code]
    );

    if (existingCode.rows.length > 0) {
      return res.status(400).json({ error: '客户编号已存在' });
    }

    // 加密密码
    const passwordHash = await hashPassword(password);

    // 创建用户
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, customer_code, role, company_name, contact_name, email, phone)
       VALUES ($1, $2, $3, 'customer', $4, $5, $6, $7)
       RETURNING id, username, customer_code, role, company_name, contact_name, email, phone, created_at`,
      [
        username,
        passwordHash,
        customer_code,
        company_name || null,
        contact_name || null,
        email || null,
        phone || null,
      ]
    );

    res.status(201).json({
      message: '客户账号创建成功',
      user: result.rows[0],
    });
  } catch (error) {
    console.error('创建客户错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

