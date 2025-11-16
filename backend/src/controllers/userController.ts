import { Response } from 'express';
import { pool } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { hashPassword, comparePassword } from '../utils/password.js';

// 获取用户列表（仅管理员）
export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const {
      role,
      is_active,
      search,
      page = 1,
      pageSize = 20,
    } = req.query;

    let whereConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (role) {
      whereConditions.push(`role = $${paramIndex++}`);
      params.push(role);
    }

    if (is_active !== undefined) {
      whereConditions.push(`is_active = $${paramIndex++}`);
      params.push(is_active === 'true');
    }

    if (search) {
      whereConditions.push(
        `(username ILIKE $${paramIndex++} OR company_name ILIKE $${paramIndex++} OR contact_name ILIKE $${paramIndex++} OR customer_code ILIKE $${paramIndex++})`
      );
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

    const offset = (Number(page) - 1) * Number(pageSize);
    params.push(Number(pageSize), offset);

    // 先尝试使用新字段查询，如果字段不存在则使用备用查询
    let countResult: any;
    let result: any;
    
    try {
      // 尝试使用包含 admin_notes 的查询
      const query = `
        SELECT 
          id, username, customer_code, role, company_name, contact_name, 
          email, phone, assigned_order_types, admin_notes, is_active, 
          created_at, updated_at
        FROM users
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
      
      countResult = await pool.query(
        countQuery,
        params.slice(0, params.length - 2)
      );
      result = await pool.query(query, params);
    } catch (error: any) {
      // 如果字段不存在，使用旧的查询（向后兼容）
      if (error.code === '42703') {
        const query = `
          SELECT 
            id, username, customer_code, role, company_name, contact_name, 
            email, phone, assigned_order_types, is_active, 
            created_at, updated_at
          FROM users
          ${whereClause}
          ORDER BY created_at DESC
          LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;
        const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
        
        countResult = await pool.query(
          countQuery,
          params.slice(0, params.length - 2)
        );
        result = await pool.query(query, params);
        
        // 为旧数据添加默认值
        result.rows.forEach((row: any) => {
          row.admin_notes = null;
        });
      } else {
        throw error;
      }
    }

    res.json({
      users: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(
          parseInt(countResult.rows[0].total) / Number(pageSize)
        ),
      },
    });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 获取用户详情（仅管理员）
export const getUserById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    let result;
    try {
      result = await pool.query(
        `SELECT 
          id, username, customer_code, role, company_name, contact_name, 
          email, phone, assigned_order_types, admin_notes, is_active, 
          created_at, updated_at
        FROM users WHERE id = $1`,
        [id]
      );
    } catch (error: any) {
      // 如果字段不存在，使用旧的查询（向后兼容）
      if (error.code === '42703') {
        result = await pool.query(
          `SELECT 
            id, username, customer_code, role, company_name, contact_name, 
            email, phone, assigned_order_types, is_active, 
            created_at, updated_at
          FROM users WHERE id = $1`,
          [id]
        );
        // 为旧数据添加默认值
        if (result.rows.length > 0) {
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
    console.error('获取用户详情错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 创建用户（仅管理员）
export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const {
      username,
      password,
      role = 'customer',
      customer_code,
      company_name,
      contact_name,
      email,
      phone,
      admin_notes,
      assigned_order_types,
    } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    if (role === 'customer' && !customer_code) {
      return res.status(400).json({ error: '客户角色必须提供客户编号' });
    }

    // 检查用户名是否已存在
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    // 检查客户编号是否已存在（如果是客户角色）
    if (customer_code) {
      const existingCode = await pool.query(
        'SELECT id FROM users WHERE customer_code = $1',
        [customer_code]
      );

      if (existingCode.rows.length > 0) {
        return res.status(400).json({ error: '客户编号已存在' });
      }
    }

    // 加密密码
    const passwordHash = await hashPassword(password);

    // 检查 admin_notes 字段是否存在
    let hasAdminNotes = false;
    try {
      const checkResult = await pool.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'users' AND column_name = 'admin_notes'`
      );
      hasAdminNotes = checkResult.rows.length > 0;
    } catch (error) {
      // 如果检查失败，假设字段不存在
      hasAdminNotes = false;
    }

    // 创建用户
    let result: any;
    if (hasAdminNotes) {
      result = await pool.query(
        `INSERT INTO users (
          username, password_hash, role, customer_code, company_name, 
          contact_name, email, phone, admin_notes, assigned_order_types
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, username, customer_code, role, company_name, contact_name, 
                  email, phone, assigned_order_types, admin_notes, is_active, created_at`,
        [
          username,
          passwordHash,
          role,
          customer_code || null,
          company_name || null,
          contact_name || null,
          email || null,
          phone || null,
          admin_notes || null,
          assigned_order_types ? JSON.stringify(assigned_order_types) : '[]',
        ]
      );
    } else {
      result = await pool.query(
        `INSERT INTO users (
          username, password_hash, role, customer_code, company_name, 
          contact_name, email, phone, assigned_order_types
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, username, customer_code, role, company_name, contact_name, 
                  email, phone, assigned_order_types, is_active, created_at`,
        [
          username,
          passwordHash,
          role,
          customer_code || null,
          company_name || null,
          contact_name || null,
          email || null,
          phone || null,
          assigned_order_types ? JSON.stringify(assigned_order_types) : '[]',
        ]
      );
      // 为结果添加默认值
      result.rows[0].admin_notes = null;
    }

    res.status(201).json({
      message: '用户创建成功',
      user: result.rows[0],
    });
  } catch (error) {
    console.error('创建用户错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 更新用户信息（仅管理员）
export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      company_name,
      contact_name,
      email,
      phone,
      admin_notes,
      assigned_order_types,
      is_active,
    } = req.body;

    // 检查用户是否存在
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [
      id,
    ]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (company_name !== undefined) {
      updates.push(`company_name = $${paramIndex++}`);
      values.push(company_name);
    }
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
    if (admin_notes !== undefined) {
      // 检查字段是否存在，如果不存在则跳过
      try {
        // 先尝试查询字段是否存在
        const checkResult = await pool.query(
          `SELECT column_name FROM information_schema.columns 
           WHERE table_name = 'users' AND column_name = 'admin_notes'`
        );
        if (checkResult.rows.length > 0) {
          updates.push(`admin_notes = $${paramIndex++}`);
          values.push(admin_notes);
        }
      } catch (error) {
        // 如果检查失败，跳过该字段
        console.warn('admin_notes 字段不存在，跳过更新');
      }
    }
    if (assigned_order_types !== undefined) {
      updates.push(`assigned_order_types = $${paramIndex++}`);
      values.push(JSON.stringify(assigned_order_types));
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }

    values.push(id);
    const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await pool.query(updateQuery, values);

    res.json({
      message: '用户信息更新成功',
      user: result.rows[0],
    });
  } catch (error) {
    console.error('更新用户信息错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 删除用户（仅管理员，软删除）
export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // 检查用户是否存在
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [
      id,
    ]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = userResult.rows[0];

    // 不能删除自己
    if (user.id === req.user!.userId) {
      return res.status(400).json({ error: '不能删除自己的账号' });
    }

    // 软删除：设置 is_active = false
    await pool.query('UPDATE users SET is_active = false WHERE id = $1', [id]);

    res.json({
      message: '用户已删除',
    });
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 重置用户密码（仅管理员）
export const resetUserPassword = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password) {
      return res.status(400).json({ error: '新密码不能为空' });
    }

    // 检查用户是否存在
    const userResult = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [id]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 加密新密码
    const passwordHash = await hashPassword(new_password);

    // 更新密码
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      passwordHash,
      id,
    ]);

    res.json({
      message: '密码重置成功',
    });
  } catch (error) {
    console.error('重置密码错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 启用/禁用用户（仅管理员）
export const toggleUserStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active 必须是布尔值' });
    }

    // 检查用户是否存在
    const userResult = await pool.query('SELECT id FROM users WHERE id = $1', [
      id,
    ]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = userResult.rows[0];
    
    // 不能禁用自己
    if (user.id === req.user!.userId && !is_active) {
      return res.status(400).json({ error: '不能禁用自己的账号' });
    }

    // 更新状态
    await pool.query('UPDATE users SET is_active = $1 WHERE id = $2', [
      is_active,
      id,
    ]);

    res.json({
      message: is_active ? '用户已启用' : '用户已禁用',
    });
  } catch (error) {
    console.error('更新用户状态错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

