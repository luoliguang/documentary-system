/**
 * 订单分配控制器
 * 负责订单分配相关的操作
 */

import { Response } from 'express';
import { pool } from '../../config/database.js';
import { AuthRequest } from '../../middleware/auth.js';
import {
  createNotification,
  markOrderNotificationsAsRead,
} from '../../services/notificationService.js';
import { ORDER_STATUS } from '../../constants/orderStatus.js';
import { getOrderTypeLabel } from '../../constants/orderType.js';
import { getProductionManagerOrderTypes } from '../../services/permissionService.js';
import {
  syncOrderAssignments,
  ORDER_ASSIGNMENT_COLUMNS,
} from '../../services/orderAssignmentService.js';
import { addOrderActivity } from '../../services/activityService.js';
import { getOrderDisplayNumberSimple, getOrderDisplayInfo } from '../../utils/orderDisplayUtils.js';
import type { PoolClient } from 'pg';

/**
 * 分配订单给生产跟单（仅管理员）
 */
export const assignOrderToProductionManager = async (
  req: AuthRequest,
  res: Response
) => {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    const user = req.user!;
    const { id } = req.params;
    const {
      assigned_to,
      assigned_to_ids,
      primary_assigned_to,
    }: {
      assigned_to?: number | null;
      assigned_to_ids?: number[];
      primary_assigned_to?: number | null;
    } = req.body || {};

    if (user.role !== 'admin') {
      return res.status(403).json({ error: '无权操作' });
    }

    const orderId = Number(id);
    await client.query('BEGIN');
    transactionStarted = true;

    const orderResult = await client.query(
      'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
      [orderId]
    );
    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ error: '订单不存在' });
    }
    const order = orderResult.rows[0];

    let targetIds: number[] | undefined;
    if (assigned_to_ids !== undefined) {
      targetIds = assigned_to_ids;
    } else if (assigned_to !== undefined) {
      targetIds = assigned_to ? [assigned_to] : [];
    } else {
      targetIds = [];
    }
    const uniqueTargets = Array.from(new Set((targetIds || []).filter((id) => !!id)));

    let primaryAssigned =
      primary_assigned_to !== undefined
        ? primary_assigned_to
        : uniqueTargets.length > 0
        ? uniqueTargets[0]
        : null;
    if (primaryAssigned && !uniqueTargets.includes(primaryAssigned)) {
      primaryAssigned = uniqueTargets[0] ?? null;
    }

    if (uniqueTargets.length > 0) {
      const pmResult = await client.query(
        `SELECT id, role, username FROM users WHERE id = ANY($1::int[])`,
        [uniqueTargets]
      );
      if (pmResult.rows.length !== uniqueTargets.length) {
        await client.query('ROLLBACK');
        transactionStarted = false;
        return res.status(400).json({ error: '存在无效的生产跟单ID' });
      }
      for (const pm of pmResult.rows) {
        if (pm.role !== 'production_manager') {
          await client.query('ROLLBACK');
          transactionStarted = false;
          return res
            .status(400)
            .json({ error: `用户 ${pm.username} 不是生产跟单` });
        }
        const allowedTypes = await getProductionManagerOrderTypes(pm.id);
        if (allowedTypes.length && order.order_type && !allowedTypes.includes(order.order_type)) {
          await client.query('ROLLBACK');
          transactionStarted = false;
          return res.status(400).json({
            error: `生产跟单 ${pm.username} 无权处理 ${order.order_type} 类型订单`,
          });
        }
      }
    }

    const { added, removed, current } = await syncOrderAssignments(
      client,
      orderId,
      uniqueTargets,
      user.userId
    );

    let newStatus = order.status;
    let statusNote: string | null = null;
    if (current.length > 0) {
      if (
        !order.status ||
        [ORDER_STATUS.PENDING, ORDER_STATUS.ASSIGNED].includes(order.status as any)
      ) {
        newStatus = ORDER_STATUS.ASSIGNED;
        statusNote = '分配订单';
      }
    } else if (order.status === ORDER_STATUS.ASSIGNED) {
      newStatus = ORDER_STATUS.PENDING;
      statusNote = '取消分配';
    }

    const updatedOrderResult = await client.query(
      `UPDATE orders 
       SET assigned_to = $1, status = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 
       RETURNING *`,
      [primaryAssigned, newStatus, orderId]
    );
    const updatedOrder = updatedOrderResult.rows[0];

    if (statusNote && order.status !== newStatus) {
      await client.query(
        `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, order.status, newStatus, user.userId, statusNote]
      );
    }

    await client.query('COMMIT');
    transactionStarted = false;

    const fullOrderResult = await pool.query(
      `
        SELECT o.*, 
               u.company_name, 
               u.contact_name, 
               u.phone as customer_phone, 
               u.email as customer_email,
               u.admin_notes as customer_admin_notes,
               pm.username as assigned_to_name,
               ${ORDER_ASSIGNMENT_COLUMNS}
        FROM orders o
        LEFT JOIN users u ON o.customer_id = u.id
        LEFT JOIN users pm ON o.assigned_to = pm.id
        WHERE o.id = $1
      `,
      [orderId]
    );
    const fullOrder = fullOrderResult.rows[0];

    if (added.length > 0) {
      for (const pmId of added) {
        try {
          // 获取接收通知的用户角色
          const userResult = await pool.query(
            'SELECT role FROM users WHERE id = $1',
            [pmId]
          );
          const recipientRole = userResult.rows[0]?.role;
          
          const orderTypeText = getOrderTypeLabel(order.order_type as any) || order.order_type;
          
          // 根据接收者角色生成订单编号显示
          const displayNumber = getOrderDisplayNumberSimple(
            {
              order_number: order.order_number,
              customer_order_number: order.customer_order_number,
            },
            recipientRole
          );
          
          const title = `订单分配：${displayNumber}`;
          const orderInfo = getOrderDisplayInfo(
            {
              order_number: order.order_number,
              customer_order_number: order.customer_order_number,
            },
            recipientRole
          );
          const content = `您已被分配处理订单（${orderTypeText}类型）。\n${orderInfo}\n客户：${fullOrder.company_name || fullOrder.contact_name || '未知'}`;
          
          const createdNotification = await createNotification({
            user_id: pmId,
            type: 'assignment',
            title,
            content,
            related_id: orderId,
            related_type: 'order',
          });
          
          // 实时推送通知
          const { emitNotificationCreated } = await import('../../websocket/emitter.js');
          emitNotificationCreated(createdNotification);
        } catch (notificationError) {
          console.error('创建分配通知失败:', notificationError);
        }
      }
    }

    if (user.role === 'admin' && current.length > 0) {
      try {
        await markOrderNotificationsAsRead(user.userId, orderId);
      } catch (error) {
        console.error('标记通知为已读失败:', error);
      }
    }

    // 记录操作日志
    if (current.length > 0) {
      const pmNames = fullOrder.assigned_to_names || [];
      const actionText = pmNames.length > 0 
        ? `将订单分配给：${pmNames.join('、')}`
        : '分配订单给生产跟单';
      
      await addOrderActivity({
        orderId,
        userId: user.userId,
        actionType: 'assigned',
        actionText,
        extraData: {
          assigned_to_ids: current,
          assigned_to_names: pmNames,
        },
        isVisibleToCustomer: false,
      });
    } else if (removed.length > 0) {
      await addOrderActivity({
        orderId,
        userId: user.userId,
        actionType: 'assigned',
        actionText: '取消订单分配',
        extraData: {
          removed_ids: removed,
        },
        isVisibleToCustomer: false,
      });
    }

    // 实时推送
    const { emitOrderUpdated } = await import('../../websocket/emitter.js');
    emitOrderUpdated(orderId, fullOrder);

    res.json({
      message: current.length ? '订单分配成功' : '订单分配已取消',
      order: fullOrder,
      assignment_changes: { added, removed },
    });
  } catch (error: any) {
    if (transactionStarted) {
      await client.query('ROLLBACK');
    }
    console.error('分配订单错误:', error);
    res.status(500).json({ error: error.message || '服务器内部错误' });
  } finally {
    client.release();
  }
};

