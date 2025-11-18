import { Response } from 'express';
import { pool } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { canUpdateOrderField, checkPermission } from '../utils/permissionCheck.js';
import { deleteImagesFromOSS } from '../services/ossService.js';
import {
  createNotification,
  markOrderNotificationsAsRead,
} from '../services/notificationService.js';

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
        order_number,
        customer_order_number,
        status,
        order_type,
        is_completed,
        can_ship,
        company_name,
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
      if (order_number) {
        whereConditions.push(`o.order_number ILIKE $${paramIndex++}`);
        params.push(`%${order_number}%`);
      }
      if (customer_order_number) {
        whereConditions.push(`o.customer_order_number ILIKE $${paramIndex++}`);
        params.push(`%${customer_order_number}%`);
      }
      if (status) {
        whereConditions.push(`o.status = $${paramIndex++}`);
        params.push(status);
      }
      if (order_type) {
        whereConditions.push(`o.order_type = $${paramIndex++}`);
        params.push(order_type);
      }
      if (is_completed !== undefined) {
        whereConditions.push(`o.is_completed = $${paramIndex++}`);
        params.push(is_completed === 'true');
      }
      if (can_ship !== undefined) {
        whereConditions.push(`o.can_ship = $${paramIndex++}`);
        params.push(can_ship === 'true');
      }
      if (company_name) {
        whereConditions.push(`u.company_name ILIKE $${paramIndex++}`);
        params.push(`%${company_name}%`);
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(' AND ')}`
          : '';

      const offset = (Number(page) - 1) * Number(pageSize);
      params.push(Number(pageSize), offset);

      query = `
        SELECT o.*, 
               u.company_name, 
               u.contact_name, 
               u.phone as customer_phone, 
               u.email as customer_email,
               pm.username as assigned_to_name
        FROM orders o
        LEFT JOIN users u ON o.customer_id = u.id
        LEFT JOIN users pm ON o.assigned_to = pm.id
        ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      // 如果使用了 company_name 筛选，countQuery 也需要 JOIN users 表
      const countQuery = company_name 
        ? `SELECT COUNT(*) as total FROM orders o LEFT JOIN users u ON o.customer_id = u.id ${whereClause}`
        : `SELECT COUNT(*) as total FROM orders o ${whereClause}`;
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
    } else if (user.role === 'production_manager') {
      // 生产跟单：只能查看分配的订单类型
      const {
        order_number,
        customer_order_number,
        status,
        order_type,
        is_completed,
        page = 1,
        pageSize = 20,
      } = req.query;

      // 获取该生产跟单的订单类型权限
      let assignedTypes: string[] = [];
      try {
        const userResult = await pool.query(
          'SELECT assigned_order_types FROM users WHERE id = $1',
          [user.userId]
        );
        assignedTypes = userResult.rows[0]?.assigned_order_types || [];
      } catch (error: any) {
        // 如果字段不存在，说明数据库还未迁移，返回空列表
        if (error.code === '42703') {
          assignedTypes = [];
        } else {
          throw error;
        }
      }

      if (assignedTypes.length === 0) {
        // 如果没有分配订单类型，返回空列表
        return res.json({
          orders: [],
          pagination: {
            total: 0,
            page: Number(page),
            pageSize: Number(pageSize),
            totalPages: 0,
          },
        });
      }

      let whereConditions: string[] = [];
      params = [];
      let paramIndex = 1;

      // 生产跟单只能查看分配给自己的订单
      whereConditions.push(`o.assigned_to = $${paramIndex++}`);
      params.push(user.userId);

      if (order_number) {
        whereConditions.push(`o.order_number ILIKE $${paramIndex++}`);
        params.push(`%${order_number}%`);
      }
      if (customer_order_number) {
        whereConditions.push(`o.customer_order_number ILIKE $${paramIndex++}`);
        params.push(`%${customer_order_number}%`);
      }
      if (status) {
        whereConditions.push(`o.status = $${paramIndex++}`);
        params.push(status);
      }
      // 如果指定了订单类型，需要确保在分配的范围内
      if (order_type) {
        const orderTypeStr = String(order_type);
        if (assignedTypes.includes(orderTypeStr)) {
          whereConditions.push(`o.order_type = $${paramIndex++}`);
          params.push(orderTypeStr);
        } else {
          // 如果请求的订单类型不在权限范围内，返回空列表
          return res.json({
            orders: [],
            pagination: {
              total: 0,
              page: Number(page),
              pageSize: Number(pageSize),
              totalPages: 0,
            },
          });
        }
      }
      if (is_completed !== undefined) {
        whereConditions.push(`o.is_completed = $${paramIndex++}`);
        params.push(is_completed === 'true');
      }

      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
      const offset = (Number(page) - 1) * Number(pageSize);
      params.push(Number(pageSize), offset);

      query = `
        SELECT o.*, 
               u.company_name, 
               u.contact_name, 
               u.phone as customer_phone, 
               u.email as customer_email,
               pm.username as assigned_to_name
        FROM orders o
        LEFT JOIN users u ON o.customer_id = u.id
        LEFT JOIN users pm ON o.assigned_to = pm.id
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
      const {
        order_number,
        customer_order_number,
        status,
        is_completed,
        page = 1,
        pageSize = 20,
      } = req.query;
      let whereConditions = ['o.customer_id = $1'];
      params = [user.userId];
      let paramIndex = 2;

      if (order_number) {
        whereConditions.push(`o.order_number ILIKE $${paramIndex++}`);
        params.push(`%${order_number}%`);
      }
      if (customer_order_number) {
        whereConditions.push(`o.customer_order_number ILIKE $${paramIndex++}`);
        params.push(`%${customer_order_number}%`);
      }
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

      // 客户查询时不包含生产跟单信息
      query = `
        SELECT o.*, 
               u.company_name, 
               u.contact_name
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

      // 客户查询时，明确删除生产跟单相关字段
      const orders = result.rows.map((order: any) => {
        const { assigned_to, assigned_to_name, ...rest } = order;
        return rest;
      });

      res.json({
        orders,
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
    let params: any[];

    if (user.role === 'admin') {
      query = `
        SELECT o.*, 
               u.company_name, 
               u.contact_name, 
               u.phone as customer_phone, 
               u.email as customer_email,
               pm.username as assigned_to_name
        FROM orders o
        LEFT JOIN users u ON o.customer_id = u.id
        LEFT JOIN users pm ON o.assigned_to = pm.id
        WHERE o.id = $1
      `;
      params = [id];
    } else if (user.role === 'production_manager') {
      // 生产跟单：检查订单类型是否在权限范围内
      let assignedTypes: string[] = [];
      try {
        const userResult = await pool.query(
          'SELECT assigned_order_types FROM users WHERE id = $1',
          [user.userId]
        );
        assignedTypes = userResult.rows[0]?.assigned_order_types || [];
      } catch (error: any) {
        // 如果字段不存在，说明数据库还未迁移，返回403
        if (error.code === '42703') {
          return res.status(403).json({ error: '无权访问' });
        } else {
          throw error;
        }
      }

      if (assignedTypes.length === 0) {
        return res.status(403).json({ error: '无权访问' });
      }

      // 生产跟单只能查看分配给自己的订单
      query = `
        SELECT o.*, 
               u.company_name, 
               u.contact_name, 
               u.phone as customer_phone, 
               u.email as customer_email,
               pm.username as assigned_to_name
        FROM orders o
        LEFT JOIN users u ON o.customer_id = u.id
        LEFT JOIN users pm ON o.assigned_to = pm.id
        WHERE o.id = $1 AND o.assigned_to = $2
      `;
      params = [id, user.userId];
    } else {
      // 客户查询时不包含生产跟单信息
      query = `
        SELECT o.*, 
               u.company_name, 
               u.contact_name
        FROM orders o
        LEFT JOIN users u ON o.customer_id = u.id
        WHERE o.id = $1 AND o.customer_id = $2
      `;
      params = [id, user.userId];
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在或无权访问' });
    }

    const order = result.rows[0];
    if (user.role === 'customer') {
      // 客户查询时，删除内部信息和生产跟单相关字段
      delete order.internal_notes;
      delete order.assigned_to;
      delete order.assigned_to_name;
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
      order_type = 'required',
      notes,
      internal_notes,
      estimated_ship_date,
      order_date,
      images,
      shipping_tracking_numbers,
    } = req.body;

    if (!order_number || !customer_id) {
      return res.status(400).json({ error: '订单编号和客户ID不能为空' });
    }

    // 验证下单时间
    if (order_date) {
      const orderDate = new Date(order_date);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // 设置为今天的最后一刻
      if (orderDate > today) {
        return res.status(400).json({ error: '下单时间不能晚于当前日期' });
      }
    } else {
      return res.status(400).json({ error: '下单时间不能为空' });
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
        status, order_type, notes, internal_notes, estimated_ship_date, order_date, images, shipping_tracking_numbers, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        order_number,
        customer_id,
        finalCustomerCode,
        customer_order_number || null,
        status,
        order_type,
        notes || null,
        internal_notes || null,
        estimated_ship_date || null,
        order_date || null,
        images ? JSON.stringify(images) : '[]',
        shipping_tracking_numbers ? JSON.stringify(shipping_tracking_numbers) : '[]',
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
      order_date,
      notes,
      internal_notes,
      order_number,
      customer_order_number,
      customer_id,
      order_type,
      images,
      shipping_tracking_numbers,
    } = req.body;

    const oldOrderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );
    if (oldOrderResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const oldOrder = oldOrderResult.rows[0];

    // 权限检查：非管理员需要检查权限
    if (user.role !== 'admin') {
      // 客户角色不能更新订单
      if (user.role === 'customer') {
        const canUpdate = await checkPermission(user.role, 'orders', 'can_update');
        if (!canUpdate) {
          return res.status(403).json({ error: '客户没有权限更新订单' });
        }
      }

      // 生产跟单需要检查订单访问权限
      if (user.role === 'production_manager') {
        // 检查生产跟单是否有权限查看此订单
        // 1. 检查订单是否分配给该生产跟单
        // 2. 检查订单类型是否在分配的类型中
        let hasPermission = false;
        
        // 检查是否分配给该生产跟单
        if (oldOrder.assigned_to === user.userId) {
          hasPermission = true;
        } else {
          // 检查订单类型是否在分配的类型中
          try {
            const userResult = await pool.query(
              'SELECT assigned_order_types FROM users WHERE id = $1',
              [user.userId]
            );
            if (userResult.rows.length > 0) {
              const assignedTypes = userResult.rows[0].assigned_order_types || [];
              if (Array.isArray(assignedTypes) && assignedTypes.includes(oldOrder.order_type)) {
                hasPermission = true;
              }
            }
          } catch (error) {
            // 如果字段不存在，使用默认逻辑
            console.warn('assigned_order_types 字段不存在，使用默认权限检查');
          }
        }

        if (!hasPermission) {
          return res.status(403).json({ error: '您没有权限更新此订单' });
        }
      }
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    const disallowedFields: string[] = [];

    // 动态权限检查：根据配置表检查每个字段的更新权限
    if (status !== undefined) {
      const canUpdate = user.role === 'admin' || await canUpdateOrderField(user.role, 'status');
      if (canUpdate) {
        updates.push(`status = $${paramIndex++}`);
        values.push(status);
      } else {
        disallowedFields.push('status');
      }
    }
    
    if (is_completed !== undefined) {
      const canUpdate = user.role === 'admin' || await canUpdateOrderField(user.role, 'is_completed');
      if (canUpdate) {
        updates.push(`is_completed = $${paramIndex++}`);
        values.push(is_completed);
      } else {
        disallowedFields.push('is_completed');
      }
    }
    
    if (can_ship !== undefined) {
      const canUpdate = user.role === 'admin' || await canUpdateOrderField(user.role, 'can_ship');
      if (canUpdate) {
        updates.push(`can_ship = $${paramIndex++}`);
        values.push(can_ship);
      } else {
        disallowedFields.push('can_ship');
      }
    }
    
    if (estimated_ship_date !== undefined) {
      const canUpdate = user.role === 'admin' || await canUpdateOrderField(user.role, 'estimated_ship_date');
      if (canUpdate) {
        updates.push(`estimated_ship_date = $${paramIndex++}`);
        values.push(estimated_ship_date || null);
      } else {
        disallowedFields.push('estimated_ship_date');
      }
    }
    
    if (actual_ship_date !== undefined) {
      const canUpdate = user.role === 'admin';
      if (canUpdate) {
        updates.push(`actual_ship_date = $${paramIndex++}`);
        values.push(actual_ship_date || null);
      } else {
        disallowedFields.push('actual_ship_date');
      }
    }
    
    if (notes !== undefined) {
      const canUpdate = user.role === 'admin' || await canUpdateOrderField(user.role, 'notes');
      if (canUpdate) {
        updates.push(`notes = $${paramIndex++}`);
        values.push(notes);
      } else {
        disallowedFields.push('notes');
      }
    }
    
    if (internal_notes !== undefined) {
      const canUpdate = user.role === 'admin';
      if (canUpdate) {
        updates.push(`internal_notes = $${paramIndex++}`);
        values.push(internal_notes);
      } else {
        disallowedFields.push('internal_notes');
      }
    }
    
    if (order_number !== undefined) {
      const canUpdate = user.role === 'admin';
      if (canUpdate) {
        // 检查订单编号是否已被其他订单使用（排除当前订单）
        const existingOrder = await pool.query(
          'SELECT id FROM orders WHERE order_number = $1 AND id != $2',
          [order_number, id]
        );
        if (existingOrder.rows.length > 0) {
          return res.status(400).json({ error: '工厂订单编号已存在，请使用其他编号' });
        }
        updates.push(`order_number = $${paramIndex++}`);
        values.push(order_number);
      } else {
        disallowedFields.push('order_number');
      }
    }
    
    if (customer_order_number !== undefined) {
      const canUpdate = user.role === 'admin';
      if (canUpdate) {
        updates.push(`customer_order_number = $${paramIndex++}`);
        values.push(customer_order_number);
      } else {
        disallowedFields.push('customer_order_number');
      }
    }
    
    if (customer_id !== undefined) {
      const canUpdate = user.role === 'admin';
      if (canUpdate) {
        // 验证客户是否存在
        const customerResult = await pool.query(
          'SELECT id, customer_code FROM users WHERE id = $1 AND role = $2',
          [customer_id, 'customer']
        );
        if (customerResult.rows.length === 0) {
          return res.status(400).json({ error: '客户不存在' });
        }
        
        // 更新 customer_id 和 customer_code
        updates.push(`customer_id = $${paramIndex++}`);
        values.push(customer_id);
        updates.push(`customer_code = $${paramIndex++}`);
        values.push(customerResult.rows[0].customer_code);
      } else {
        disallowedFields.push('customer_id');
      }
    }
    
    if (order_type !== undefined) {
      const canUpdate = user.role === 'admin' || await canUpdateOrderField(user.role, 'order_type');
      if (canUpdate) {
        updates.push(`order_type = $${paramIndex++}`);
        values.push(order_type);
      } else {
        disallowedFields.push('order_type');
      }
    }
    
    if (images !== undefined) {
      const canUpdate = user.role === 'admin';
      if (canUpdate) {
        updates.push(`images = $${paramIndex++}`);
        values.push(JSON.stringify(images));
      } else {
        disallowedFields.push('images');
      }
    }
    
    if (order_date !== undefined) {
      // 验证下单时间
      if (order_date) {
        const orderDate = new Date(order_date);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (orderDate > today) {
          return res.status(400).json({ error: '下单时间不能晚于当前日期' });
        }
      }
      const canUpdate = user.role === 'admin';
      if (canUpdate) {
        updates.push(`order_date = $${paramIndex++}`);
        values.push(order_date || null);
      } else {
        disallowedFields.push('order_date');
      }
    }

    if (shipping_tracking_numbers !== undefined) {
      const canUpdate = user.role === 'admin';
      if (canUpdate) {
        updates.push(`shipping_tracking_numbers = $${paramIndex++}`);
        values.push(JSON.stringify(shipping_tracking_numbers));
      } else {
        disallowedFields.push('shipping_tracking_numbers');
      }
    }

    // 如果有不允许更新的字段，返回错误
    if (disallowedFields.length > 0) {
      console.error(`[订单更新] 权限不足: 用户 ${user.userId} (${user.role}) 尝试更新字段: ${disallowedFields.join(', ')}`);
      return res.status(403).json({ 
        error: `您没有权限更新以下字段: ${disallowedFields.join(', ')}。请在系统配置中检查您的权限设置。` 
      });
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

    // 获取完整的订单信息（包含关联的客户信息）
    const fullOrderQuery = `
      SELECT o.*, 
             u.company_name, 
             u.contact_name, 
             u.phone as customer_phone, 
             u.email as customer_email,
             pm.username as assigned_to_name
      FROM orders o
      LEFT JOIN users u ON o.customer_id = u.id
      LEFT JOIN users pm ON o.assigned_to = pm.id
      WHERE o.id = $1
    `;
    const fullOrderResult = await pool.query(fullOrderQuery, [id]);

    res.json({
      message: '订单更新成功',
      order: fullOrderResult.rows[0],
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
    let orderParams: any[];

    if (user.role === 'admin') {
      orderQuery = 'SELECT id FROM orders WHERE id = $1';
      orderParams = [id];
    } else if (user.role === 'production_manager') {
      // 生产跟单：检查订单类型是否在权限范围内
      let assignedTypes: string[] = [];
      try {
        const userResult = await pool.query(
          'SELECT assigned_order_types FROM users WHERE id = $1',
          [user.userId]
        );
        assignedTypes = userResult.rows[0]?.assigned_order_types || [];
      } catch (error: any) {
        // 如果字段不存在，说明数据库还未迁移，返回403
        if (error.code === '42703') {
          return res.status(403).json({ error: '无权访问' });
        } else {
          throw error;
        }
      }

      if (assignedTypes.length === 0) {
        return res.status(403).json({ error: '无权访问' });
      }

      orderQuery = 'SELECT id FROM orders WHERE id = $1 AND order_type = ANY($2::text[])';
      orderParams = [id, assignedTypes];
    } else {
      orderQuery = 'SELECT id FROM orders WHERE id = $1 AND customer_id = $2';
      orderParams = [id, user.userId];
    }

    const orderResult = await pool.query(orderQuery, orderParams);
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

// 获取所有生产跟单列表（仅管理员）
export const getProductionManagers = async (req: AuthRequest, res: Response) => {
  try {
    // 检查 admin_notes 字段是否存在
    let hasAdminNotes = false;
    try {
      const checkResult = await pool.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'users' AND column_name = 'admin_notes'`
      );
      hasAdminNotes = checkResult.rows.length > 0;
    } catch (error) {
      hasAdminNotes = false;
    }

    let result;
    if (hasAdminNotes) {
      result = await pool.query(
        `SELECT id, username, company_name, contact_name, email, phone, assigned_order_types, admin_notes, created_at
         FROM users WHERE role = 'production_manager' AND is_active = true
         ORDER BY created_at DESC`
      );
    } else {
      result = await pool.query(
        `SELECT id, username, company_name, contact_name, email, phone, assigned_order_types, created_at
         FROM users WHERE role = 'production_manager' AND is_active = true
         ORDER BY created_at DESC`
      );
      // 为旧数据添加默认值
      result.rows.forEach((row: any) => {
        row.admin_notes = null;
      });
    }

    res.json({ productionManagers: result.rows });
  } catch (error) {
    console.error('获取生产跟单列表错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 分配订单给生产跟单（仅管理员）
export const assignOrderToProductionManager = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { assigned_to } = req.body;

    // 只有管理员可以操作
    if (user.role !== 'admin') {
      return res.status(403).json({ error: '无权操作' });
    }

    // 检查订单是否存在
    const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [
      id,
    ]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    // 如果指定了assigned_to，验证该用户是否为生产跟单
    let assignedUserInfo: any = null;
    if (assigned_to) {
      const userResult = await pool.query(
        'SELECT role, assigned_order_types, username FROM users WHERE id = $1',
        [assigned_to]
      );
      if (
        userResult.rows.length === 0 ||
        userResult.rows[0].role !== 'production_manager'
      ) {
        return res.status(400).json({ error: '指定的用户不是生产跟单' });
      }

      // 验证订单类型是否在生产跟单的权限范围内
      const order = orderResult.rows[0];
      const assignedTypes = userResult.rows[0].assigned_order_types || [];
      if (order.order_type && !assignedTypes.includes(order.order_type)) {
        return res.status(400).json({
          error: `该生产跟单没有权限处理"${order.order_type}"类型的订单`,
        });
      }
      assignedUserInfo = userResult.rows[0];
    }

    // 获取订单信息用于通知
    const order = orderResult.rows[0];
    const oldAssignedTo = order.assigned_to;

    // 更新订单
    let newStatus = order.status;
    let statusNote: string | null = null;

    if (assigned_to) {
      if (!order.status || ['pending', 'assigned'].includes(order.status)) {
        newStatus = 'assigned';
        if (order.status !== newStatus) {
          statusNote = assignedUserInfo?.username
            ? `分配给 ${assignedUserInfo.username}`
            : '分配订单';
        }
      }
    } else if (!assigned_to && oldAssignedTo) {
      if (order.status === 'assigned') {
        newStatus = 'pending';
        statusNote = '取消分配';
      }
    }

    const result = await pool.query(
      `UPDATE orders 
       SET assigned_to = $1, status = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 RETURNING *`,
      [assigned_to || null, newStatus, id]
    );

    // 获取完整的订单信息（包含关联的客户信息和管理员备注）
    const fullOrderQuery = `
      SELECT o.*, 
             u.company_name, 
             u.contact_name, 
             u.phone as customer_phone, 
             u.email as customer_email,
             u.admin_notes as customer_admin_notes,
             pm.username as assigned_to_name
      FROM orders o
      LEFT JOIN users u ON o.customer_id = u.id
      LEFT JOIN users pm ON o.assigned_to = pm.id
      WHERE o.id = $1
    `;
    const fullOrderResult = await pool.query(fullOrderQuery, [id]);
    const fullOrder = fullOrderResult.rows[0];

    // 如果分配给了生产跟单，发送通知
    if (assigned_to && assigned_to !== oldAssignedTo) {
      try {
        // 获取订单类型文本
        const orderTypeMap: Record<string, string> = {
          required: '必发',
          scattered: '散单',
          photo: '拍照',
        };
        const orderTypeText = orderTypeMap[order.order_type] || order.order_type;

        const title = `订单分配：${order.order_number}`;
        const content = `您已被分配处理订单${order.order_number}（${orderTypeText}类型）。\n客户：${fullOrder.company_name || fullOrder.contact_name || '未知'}\n客户订单编号：${order.customer_order_number || '无'}`;

        await createNotification({
          user_id: assigned_to,
          type: 'assignment',
          title,
          content,
          related_id: Number(id),
          related_type: 'order',
        });
      } catch (notificationError) {
        // 通知创建失败不影响订单分配，只记录日志
        console.error('创建分配通知失败:', notificationError);
      }
    }

    // 如果管理员分配了订单，标记相关的催单通知为已读
    if (user.role === 'admin' && assigned_to) {
      try {
        await markOrderNotificationsAsRead(user.userId, Number(id));
      } catch (error) {
        console.error('标记通知为已读失败:', error);
      }
    }

    if (statusNote && order.status !== newStatus) {
      try {
        await pool.query(
          `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, order.status, newStatus, user.userId, statusNote]
        );
      } catch (historyError) {
        console.error('记录订单状态历史失败:', historyError);
      }
    }

    res.json({
      message: assigned_to ? '订单分配成功' : '订单分配已取消',
      order: fullOrder,
    });
  } catch (error) {
    console.error('分配订单错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 删除订单（仅管理员）
export const deleteOrder = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    // 检查订单是否存在
    const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [
      id,
    ]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const order = orderResult.rows[0];

    // 删除OSS中的图片（在事务外执行，避免影响订单删除）
    try {
      if (order.images) {
        let imageUrls: string[] = [];
        try {
          // 解析images字段（可能是JSON字符串或已经是数组）
          if (typeof order.images === 'string') {
            imageUrls = JSON.parse(order.images);
          } else if (Array.isArray(order.images)) {
            imageUrls = order.images;
          }

          if (imageUrls && imageUrls.length > 0) {
            const deleteResult = await deleteImagesFromOSS(imageUrls);
            if (deleteResult.success.length > 0) {
              console.log(`订单 ${id} 已删除 ${deleteResult.success.length} 张OSS图片`);
            }
            if (deleteResult.failed.length > 0) {
              console.warn(`订单 ${id} 删除OSS图片时部分失败:`, deleteResult.failed);
            }
          }
        } catch (parseError) {
          console.error(`解析订单 ${id} 的图片数据失败:`, parseError);
        }
      }
    } catch (ossError) {
      // OSS删除失败不影响订单删除，只记录日志
      console.error(`删除订单 ${id} 的OSS图片时出错:`, ossError);
    }

    // 开始事务：删除订单相关的所有记录
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 删除订单状态历史
      await client.query(
        'DELETE FROM order_status_history WHERE order_id = $1',
        [id]
      );

      // 删除催货记录
      await client.query('DELETE FROM delivery_reminders WHERE order_id = $1', [
        id,
      ]);

      // 删除订单
      await client.query('DELETE FROM orders WHERE id = $1', [id]);

      await client.query('COMMIT');

      res.json({
        message: '订单删除成功',
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('删除订单错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

