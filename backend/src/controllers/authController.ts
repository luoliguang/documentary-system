import { Request, Response } from 'express';
import { pool } from '../config/database.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateToken } from '../utils/jwt.js';
import { AuthRequest } from '../middleware/auth.js';

// 用户登录
export const login = async (req: Request, res: Response) => {
  try {
    const { account, password } = req.body;

    if (!account || !password) {
      return res.status(400).json({ error: '账号和密码不能为空' });
    }

    // 查询用户（优先使用 account 字段，如果 account 字段不存在则使用 username 作为后备）
    let result;
    try {
      result = await pool.query(
        'SELECT * FROM users WHERE account = $1 AND is_active = true',
        [account]
      );
    } catch (error: any) {
      // 如果 account 字段不存在（向后兼容），使用 username
      if (error.code === '42703') {
        result = await pool.query(
          'SELECT * FROM users WHERE username = $1 AND is_active = true',
          [account]
        );
      } else {
        throw error;
      }
    }

    if (result.rows.length === 0) {
      return res.status(401).json({ error: '账号或密码错误' });
    }

    const user = result.rows[0];

    // 验证密码
    const isValidPassword = await comparePassword(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: '账号或密码错误' });
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

    // 先检查字段是否存在，如果不存在就使用旧的查询
    let result;
    try {
      result = await pool.query(
        'SELECT id, username, customer_code, role, company_name, contact_name, email, phone, assigned_order_types, admin_notes, created_at, updated_at FROM users WHERE id = $1',
        [userId]
      );
    } catch (error: any) {
      // 如果字段不存在，使用旧的查询（向后兼容）
      if (error.code === '42703') {
        result = await pool.query(
          'SELECT id, username, customer_code, role, company_name, contact_name, email, phone, created_at, updated_at FROM users WHERE id = $1',
          [userId]
        );
        // 为旧数据添加默认值
        if (result.rows.length > 0) {
          result.rows[0].assigned_order_types = null;
          result.rows[0].admin_notes = null;
        }
      } else {
        throw error;
      }
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 更新当前用户信息（用户自己）
export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { contact_name, email, phone } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (contact_name !== undefined) {
      updates.push(`contact_name = $${paramIndex++}`);
      values.push(contact_name);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(email);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(phone);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }

    values.push(userId);
    const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, username, customer_code, role, company_name, contact_name, email, phone, created_at, updated_at`;
    const result = await pool.query(updateQuery, values);

    res.json({
      message: '个人信息更新成功',
      user: result.rows[0],
    });
  } catch (error) {
    console.error('更新个人信息错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 修改当前用户密码
export const updatePassword = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { old_password, new_password } = req.body;

    if (!old_password || !new_password) {
      return res.status(400).json({ error: '旧密码和新密码不能为空' });
    }

    // 获取用户信息
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 验证旧密码
    const isValidPassword = await comparePassword(
      old_password,
      userResult.rows[0].password_hash
    );

    if (!isValidPassword) {
      return res.status(400).json({ error: '旧密码错误' });
    }

    // 加密新密码
    const passwordHash = await hashPassword(new_password);

    // 更新密码
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      passwordHash,
      userId,
    ]);

    res.json({
      message: '密码修改成功',
    });
  } catch (error) {
    console.error('修改密码错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 管理员创建客户账号（保留向后兼容）
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

