/**
 * 订单查询控制器
 * 负责所有订单查询相关的操作
 */

import { Response } from 'express';
import { pool } from '../../config/database.js';
import { AuthRequest } from '../../middleware/auth.js';
import { canAccessOrder, getProductionManagerOrderTypes, canViewOrderType } from '../../services/permissionService.js';
import { ORDER_ASSIGNMENT_COLUMNS } from '../../services/orderAssignmentService.js';
import { getOrderActivities } from '../../services/activityService.js';
import { parsePaginationParams } from '../../utils/configHelpers.js';

/**
 * 获取订单列表（管理员查看所有，客户只能查看自己的）
 */
const isAdminOrSupportRole = (role: string) =>
  role === 'admin' || role === 'customer_service';

export const getOrders = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let query: string;
    let params: any[];

    if (isAdminOrSupportRole(user.role)) {
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
        estimated_ship_start,
        estimated_ship_end,
        page: pageParam,
        pageSize: pageSizeParam,
      } = req.query;

      const { page, pageSize } = await parsePaginationParams(pageParam, pageSizeParam);

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
      if (estimated_ship_start) {
        whereConditions.push(`o.estimated_ship_date >= $${paramIndex++}`);
        params.push(estimated_ship_start);
      }
      if (estimated_ship_end) {
        whereConditions.push(`o.estimated_ship_date < $${paramIndex++}`);
        params.push(estimated_ship_end);
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(' AND ')}`
          : '';

      const offset = (page - 1) * pageSize;
      params.push(pageSize, offset);

      query = `
        SELECT o.*, 
               u.company_name, 
               u.contact_name, 
               u.phone as customer_phone, 
               u.email as customer_email,
               pm.username as assigned_to_name,
               ${ORDER_ASSIGNMENT_COLUMNS}
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
          pageSize,
          totalPages: Math.ceil(
            parseInt(countResult.rows[0].total) / pageSize
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
        estimated_ship_start,
        estimated_ship_end,
        page: pageParam,
        pageSize: pageSizeParam,
      } = req.query;

      const { page, pageSize } = await parsePaginationParams(pageParam, pageSizeParam);

      // 获取该生产跟单的订单类型权限
      const assignedTypes = await getProductionManagerOrderTypes(user.userId);

      if (assignedTypes.length === 0) {
        // 如果没有分配订单类型，返回空列表
        return res.json({
          orders: [],
          pagination: {
            total: 0,
            page,
            pageSize,
            totalPages: 0,
          },
        });
      }

      let whereConditions: string[] = [];
      params = [];
      let paramIndex = 1;

      // 生产跟单只能查看分配给自己的订单
      whereConditions.push(
        `(o.assigned_to = $${paramIndex++} OR EXISTS (SELECT 1 FROM order_assignments oa WHERE oa.order_id = o.id AND oa.production_manager_id = $${paramIndex++}))`
      );
      params.push(user.userId, user.userId);

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
        const canView = await canViewOrderType(user.userId, orderTypeStr);
        if (canView) {
          whereConditions.push(`o.order_type = $${paramIndex++}`);
          params.push(orderTypeStr);
        } else {
          // 如果请求的订单类型不在权限范围内，返回空列表
          return res.json({
            orders: [],
          pagination: {
            total: 0,
            page,
            pageSize,
            totalPages: 0,
          },
          });
        }
      }
      if (is_completed !== undefined) {
        whereConditions.push(`o.is_completed = $${paramIndex++}`);
        params.push(is_completed === 'true');
      }
      if (estimated_ship_start) {
        whereConditions.push(`o.estimated_ship_date >= $${paramIndex++}`);
        params.push(estimated_ship_start);
      }
      if (estimated_ship_end) {
        whereConditions.push(`o.estimated_ship_date < $${paramIndex++}`);
        params.push(estimated_ship_end);
      }

      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
      const offset = (page - 1) * pageSize;
      params.push(pageSize, offset);

      query = `
        SELECT o.*, 
               u.company_name, 
               u.contact_name, 
               u.phone as customer_phone, 
               u.email as customer_email,
               pm.username as assigned_to_name,
               ${ORDER_ASSIGNMENT_COLUMNS}
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
          pageSize,
          totalPages: Math.ceil(
            parseInt(countResult.rows[0].total) / pageSize
          ),
        },
      });
    } else {
      // 客户角色：查看同一公司的所有订单
      const {
        order_number,
        customer_order_number,
        status,
        is_completed,
        estimated_ship_start,
        estimated_ship_end,
        page: pageParam,
        pageSize: pageSizeParam,
      } = req.query;
      const { page, pageSize } = await parsePaginationParams(pageParam, pageSizeParam);
      let whereConditions = ['o.company_id = (SELECT company_id FROM users WHERE id = $1)'];
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
      if (estimated_ship_start) {
        whereConditions.push(`o.estimated_ship_date >= $${paramIndex++}`);
        params.push(estimated_ship_start);
      }
      if (estimated_ship_end) {
        whereConditions.push(`o.estimated_ship_date < $${paramIndex++}`);
        params.push(estimated_ship_end);
      }

      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
      const offset = (page - 1) * pageSize;
      params.push(pageSize, offset);

      // 客户查询时不包含生产跟单信息
      query = `
        SELECT o.*, 
               u.company_name, 
               u.contact_name,
               ${ORDER_ASSIGNMENT_COLUMNS}
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
        const { assigned_to, assigned_to_name, assigned_to_ids, assigned_to_names, assigned_team, ...rest } = order;
        return rest;
      });

      res.json({
        orders,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          page: Number(page),
          pageSize,
          totalPages: Math.ceil(
            parseInt(countResult.rows[0].total) / pageSize
          ),
        },
      });
    }
  } catch (error) {
    console.error('获取订单列表错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

/**
 * 获取订单详情
 */
export const getOrderById = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    // 使用权限服务检查访问权限
    const canAccess = await canAccessOrder(user.userId, user.role, Number(id));
    if (!canAccess) {
      return res.status(403).json({ error: '订单不存在或无权访问' });
    }

    // 构建查询（根据角色决定返回的字段）
    let query: string;
    let params: any[];

    if (user.role === 'admin') {
      query = `
        SELECT o.*, 
               u.company_name, 
               u.contact_name, 
               u.phone as customer_phone, 
               u.email as customer_email,
               pm.username as assigned_to_name,
               ${ORDER_ASSIGNMENT_COLUMNS}
        FROM orders o
        LEFT JOIN users u ON o.customer_id = u.id
        LEFT JOIN users pm ON o.assigned_to = pm.id
        WHERE o.id = $1
      `;
      params = [id];
    } else if (user.role === 'production_manager') {
      query = `
        SELECT o.*, 
               u.company_name, 
               u.contact_name, 
               u.phone as customer_phone, 
               u.email as customer_email,
               pm.username as assigned_to_name,
               ${ORDER_ASSIGNMENT_COLUMNS}
        FROM orders o
        LEFT JOIN users u ON o.customer_id = u.id
        LEFT JOIN users pm ON o.assigned_to = pm.id
        WHERE o.id = $1
          AND (o.assigned_to = $2 OR EXISTS (
            SELECT 1 FROM order_assignments oa 
            WHERE oa.order_id = o.id AND oa.production_manager_id = $2
          ))
      `;
      params = [id, user.userId];
    } else {
      // 客户查询时不包含生产跟单信息
      query = `
        SELECT o.*, 
               u.company_name, 
               u.contact_name,
               ${ORDER_ASSIGNMENT_COLUMNS}
        FROM orders o
        LEFT JOIN users u ON o.customer_id = u.id
        WHERE o.id = $1 AND o.company_id = (SELECT company_id FROM users WHERE id = $2)
      `;
      params = [id, user.userId];
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const order = result.rows[0];
    if (user.role === 'customer') {
      // 客户查询时，删除内部信息和生产跟单相关字段
      delete order.internal_notes;
      delete order.assigned_to;
      delete order.assigned_to_name;
      delete order.assigned_to_ids;
      delete order.assigned_to_names;
      delete order.assigned_team;
    }

    // 获取操作日志
    const activities = await getOrderActivities(Number(id), {
      userRole: user.role,
      userId: user.userId,
    });
    order.activities = activities;

    res.json({ order });
  } catch (error) {
    console.error('获取订单详情错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

/**
 * 获取订单状态历史
 */
export const getOrderStatusHistory = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    // 使用权限服务检查访问权限
    const canAccess = await canAccessOrder(user.userId, user.role, Number(id));
    if (!canAccess) {
      return res.status(403).json({ error: '订单不存在或无权访问' });
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

/**
 * 获取所有客户列表（仅管理员）
 * 支持按公司名搜索
 */
export const getCustomers = async (req: AuthRequest, res: Response) => {
  try {
    const { company_name, company_id, search } = req.query;
    
    let whereConditions: string[] = ["u.role = 'customer'", "u.is_active = true"];
    const params: any[] = [];
    let paramIndex = 1;

    // 支持按公司ID查询（优先使用，更准确）
    if (company_id) {
      whereConditions.push(`u.company_id = $${paramIndex++}`);
      params.push(company_id);
    } else if (company_name) {
      // 支持按公司名搜索（向后兼容）
      whereConditions.push(`cc.company_name ILIKE $${paramIndex++}`);
      params.push(`%${company_name}%`);
    }

    // 支持通用搜索（用户名、公司名、客户编号）
    if (search) {
      whereConditions.push(
        `(u.username ILIKE $${paramIndex++} OR cc.company_name ILIKE $${paramIndex++} OR u.customer_code ILIKE $${paramIndex++})`
      );
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT u.id, u.username, u.customer_code, u.company_name, u.contact_name, 
              u.email, u.phone, u.company_id, cc.company_name as company_full_name,
              u.created_at
       FROM users u
       LEFT JOIN customer_companies cc ON u.company_id = cc.id
       ${whereClause}
       ORDER BY cc.company_name, u.created_at DESC`,
      params
    );

    res.json({ customers: result.rows });
  } catch (error) {
    console.error('获取客户列表错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

/**
 * 获取所有客户公司列表（仅管理员）
 */
export const getCustomerCompanies = async (req: AuthRequest, res: Response) => {
  try {
    const { search } = req.query;
    
    let whereConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(`cc.company_name ILIKE $${paramIndex++}`);
      params.push(`%${search}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT cc.id, cc.company_name, cc.company_code, cc.contact_name, 
              cc.email, cc.phone, cc.address, cc.notes,
              COUNT(DISTINCT u.id) as user_count,
              COUNT(DISTINCT o.id) as order_count,
              cc.created_at, cc.updated_at
       FROM customer_companies cc
       LEFT JOIN users u ON cc.id = u.company_id AND u.role = 'customer'
       LEFT JOIN orders o ON cc.id = o.company_id
       ${whereClause}
       GROUP BY cc.id
       ORDER BY cc.company_name`,
      params
    );

    res.json({ companies: result.rows });
  } catch (error) {
    console.error('获取客户公司列表错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

/**
 * 获取所有生产跟单列表（仅管理员）
 */
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

