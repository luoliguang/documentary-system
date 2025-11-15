import { Response } from 'express';
import { pool } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';

// 获取订单列表（管理员查看所有，客户只能查看自己的）
export const getOrders = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let query: string;
    let params: any[];

    if (user.role === 'admin') {
      const {
        customer_id,
        customer_code,
        status,
        is_completed,
        can_ship,
        page = 1,
        pageSize = 20,
      } = req.query;

      let whereConditions: string[] = [];
      params = [];
      let paramIndex = 1;

      if (customer_id) {
        whereConditions.push(`o.customer_id = $${paramIndex++}`);
        params.push(customer_id);
      }
      if (customer_code) {
        whereConditions.push(`o.customer_code = $${paramIndex++}`);
        params.push(customer_code);
      }
      if (status) {
        whereConditions.push(`o.status = $${paramIndex++}`);
        params.push(status);
      }
      if (is_completed !== undefined) {
        whereConditions.push(`o.is_completed = $${paramIndex++}`);
        params.push(is_completed === 'true');
      }
      if (can_ship !== undefined) {
        whereConditions.push(`o.can_ship = $${paramIndex++}`);
        params.push(can_ship === 'true');
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(' AND ')}`
          : '';

      const offset = (Number(page) - 1) * Number(pageSize);
      params.push(Number(pageSize), offset);

      query = `
        SELECT o.*, u.company_name, u.contact_name, u.phone as customer_phone, u.email as customer_email
        FROM orders o
        LEFT JOIN users u ON o.customer_id = u.id
        ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      const countQuery = `SELECT COUNT(*) as total FROM orders o ${whereClause}`;
      const countResult = await pool.query(
        countQuery,
        params.slice(0, params.length - 2)
      );
      const result = await pool.query(query, params);

      res.json({
        orders: result.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          page: Number(page),
          pageSize: Number(pageSize),
          totalPages: Math.ceil(
            parseInt(countResult.rows[0].total) / Number(pageSize)
          ),
        },
      });
    } else {
      const { status, is_completed, page = 1, pageSize = 20 } = req.query;
      let whereConditions = ['o.customer_id = $1'];
      params = [user.userId];
      let paramIndex = 2;

      if (status) {
        whereConditions.push(`o.status = $${paramIndex++}`);
        params.push(status);
      }
      if (is_completed !== undefined) {
        whereConditions.push(`o.is_completed = $${paramIndex++}`);
        params.push(is_completed === 'true');
      }

      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
      const offset = (Number(page) - 1) * Number(pageSize);
      params.push(Number(pageSize), offset);

      query = `
        SELECT o.*, u.company_name, u.contact_name
        FROM orders o
        LEFT JOIN users u ON o.customer_id = u.id
        ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      const countQuery = `SELECT COUNT(*) as total FROM orders o ${whereClause}`;
      const countResult = await pool.query(
        countQuery,
        params.slice(0, params.length - 2)
      );
      const result = await pool.query(query, params);

      res.json({
        orders: result.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          page: Number(page),
          pageSize: Number(pageSize),
          totalPages: Math.ceil(
            parseInt(countResult.rows[0].total) / Number(pageSize)
          ),
        },
      });
    }
  } catch (error) {
    console.error('获取订单列表错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 获取订单详情
export const getOrderById = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    let query: string;
    if (user.role === 'admin') {
      query = `
        SELECT o.*, u.company_name, u.contact_name, u.phone as customer_phone, u.email as customer_email
        FROM orders o
        LEFT JOIN users u ON o.customer_id = u.id
        WHERE o.id = $1
      `;
    } else {
      query = `
        SELECT o.*, u.company_name, u.contact_name
        FROM orders o
        LEFT JOIN users u ON o.customer_id = u.id
        WHERE o.id = $1 AND o.customer_id = $2
      `;
    }

    const params = user.role === 'admin' ? [id] : [id, user.userId];
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在或无权访问' });
    }

    const order = result.rows[0];
    if (user.role === 'customer') {
      delete order.internal_notes;
    }

    res.json({ order });
  } catch (error) {
    console.error('获取订单详情错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 创建订单（仅管理员）
export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const {
      order_number,
      customer_id,
      customer_code,
      customer_order_number,
      status = 'pending',
      notes,
      internal_notes,
      estimated_ship_date,
    } = req.body;

    if (!order_number || !customer_id) {
      return res.status(400).json({ error: '订单编号和客户ID不能为空' });
    }

    const existingOrder = await pool.query(
      'SELECT id FROM orders WHERE order_number = $1',
      [order_number]
    );
    if (existingOrder.rows.length > 0) {
      return res.status(400).json({ error: '订单编号已存在' });
    }

    const customer = await pool.query(
      'SELECT id, customer_code FROM users WHERE id = $1 AND role = $2',
      [customer_id, 'customer']
    );
    if (customer.rows.length === 0) {
      return res.status(400).json({ error: '客户不存在' });
    }

    const finalCustomerCode =
      customer_code || customer.rows[0].customer_code;

    const result = await pool.query(
      `INSERT INTO orders (
        order_number, customer_id, customer_code, customer_order_number,
        status, notes, internal_notes, estimated_ship_date, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        order_number,
        customer_id,
        finalCustomerCode,
        customer_order_number || null,
        status,
        notes || null,
        internal_notes || null,
        estimated_ship_date || null,
        user.userId,
      ]
    );

    await pool.query(
      `INSERT INTO order_status_history (order_id, new_status, changed_by, notes)
       VALUES ($1, $2, $3, $4)`,
      [result.rows[0].id, status, user.userId, '创建订单']
    );

    res.status(201).json({
      message: '订单创建成功',
      order: result.rows[0],
    });
  } catch (error) {
    console.error('创建订单错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 更新订单（仅管理员）
export const updateOrder = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const {
      status,
      is_completed,
      can_ship,
      estimated_ship_date,
      actual_ship_date,
      notes,
      internal_notes,
      customer_order_number,
    } = req.body;

    const oldOrderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );
    if (oldOrderResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const oldOrder = oldOrderResult.rows[0];
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (is_completed !== undefined) {
      updates.push(`is_completed = $${paramIndex++}`);
      values.push(is_completed);
    }
    if (can_ship !== undefined) {
      updates.push(`can_ship = $${paramIndex++}`);
      values.push(can_ship);
    }
    if (estimated_ship_date !== undefined) {
      updates.push(`estimated_ship_date = $${paramIndex++}`);
      values.push(estimated_ship_date || null);
    }
    if (actual_ship_date !== undefined) {
      updates.push(`actual_ship_date = $${paramIndex++}`);
      values.push(actual_ship_date || null);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }
    if (internal_notes !== undefined) {
      updates.push(`internal_notes = $${paramIndex++}`);
      values.push(internal_notes);
    }
    if (customer_order_number !== undefined) {
      updates.push(`customer_order_number = $${paramIndex++}`);
      values.push(customer_order_number);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }

    values.push(id);
    const updateQuery = `UPDATE orders SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await pool.query(updateQuery, values);

    if (status && status !== oldOrder.status) {
      await pool.query(
        `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, oldOrder.status, status, user.userId, '更新订单状态']
      );
    }

    res.json({
      message: '订单更新成功',
      order: result.rows[0],
    });
  } catch (error) {
    console.error('更新订单错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 完成任务（仅管理员）
export const completeOrder = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { notes } = req.body;

    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const order = orderResult.rows[0];
    const result = await pool.query(
      `UPDATE orders SET is_completed = true, status = 'completed', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [id]
    );

    await pool.query(
      `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, order.status, 'completed', user.userId, notes || '标记订单为已完成']
    );

    res.json({
      message: '订单已标记为完成',
      order: result.rows[0],
    });
  } catch (error) {
    console.error('完成任务错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 客户提交自己的订单编号
export const updateCustomerOrderNumber = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { customer_order_number } = req.body;

    if (!customer_order_number) {
      return res.status(400).json({ error: '客户订单编号不能为空' });
    }

    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND customer_id = $2',
      [id, user.userId]
    );
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在或无权访问' });
    }

    const result = await pool.query(
      `UPDATE orders SET customer_order_number = $1 WHERE id = $2 RETURNING *`,
      [customer_order_number, id]
    );

    res.json({
      message: '客户订单编号更新成功',
      order: result.rows[0],
    });
  } catch (error) {
    console.error('更新客户订单编号错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 获取订单状态历史
export const getOrderStatusHistory = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    let orderQuery: string;
    if (user.role === 'admin') {
      orderQuery = 'SELECT id FROM orders WHERE id = $1';
    } else {
      orderQuery = 'SELECT id FROM orders WHERE id = $1 AND customer_id = $2';
    }

    const orderResult = await pool.query(
      orderQuery,
      user.role === 'admin' ? [id] : [id, user.userId]
    );
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在或无权访问' });
    }

    const result = await pool.query(
      `SELECT osh.*, u.username as changed_by_username
       FROM order_status_history osh
       LEFT JOIN users u ON osh.changed_by = u.id
       WHERE osh.order_id = $1
       ORDER BY osh.created_at DESC`,
      [id]
    );

    res.json({ history: result.rows });
  } catch (error) {
    console.error('获取订单状态历史错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 获取所有客户列表（仅管理员）
export const getCustomers = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, username, customer_code, company_name, contact_name, email, phone, created_at
       FROM users WHERE role = 'customer' AND is_active = true
       ORDER BY created_at DESC`
    );

    res.json({ customers: result.rows });
  } catch (error) {
    console.error('获取客户列表错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

