import { Response } from 'express';
import { pool } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';
import {
  getUnreadCount,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteNotifications,
  markOrderNotificationsAsRead,
} from '../services/notificationService.js';

/**
 * 获取未读通知数量
 */
export const getUnreadNotificationCount = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user!;
    const count = await getUnreadCount(user.userId);

    res.json({ count });
  } catch (error) {
    console.error('获取未读通知数量错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

/**
 * 获取通知列表
 */
export const getNotificationList = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user!;
    const { page: pageParam, pageSize: pageSizeParam, is_read, type } = req.query;
    const { parsePaginationParams } = await import('../utils/configHelpers.js');
    const { page, pageSize } = await parsePaginationParams(pageParam, pageSizeParam);

    const result = await getNotifications(user.userId, {
      page: Number(page),
      pageSize: Number(pageSize),
      is_read: is_read === 'true' ? true : is_read === 'false' ? false : undefined,
      type: type as string | undefined,
    });

    res.json({
      notifications: result.notifications,
      pagination: {
        total: result.total,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(result.total / Number(pageSize)),
      },
    });
  } catch (error) {
    console.error('获取通知列表错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

/**
 * 标记通知为已读
 */
export const markNotificationAsRead = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const notification = await markAsRead(Number(id), user.userId);

    res.json({
      message: '通知已标记为已读',
      notification,
    });
  } catch (error: any) {
    if (error.message === '通知不存在或无权访问') {
      return res.status(404).json({ error: error.message });
    }
    console.error('标记通知为已读错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

/**
 * 标记所有通知为已读
 */
export const markAllNotificationsAsRead = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user!;
    const count = await markAllAsRead(user.userId);

    res.json({
      message: '所有通知已标记为已读',
      count,
    });
  } catch (error) {
    console.error('标记所有通知为已读错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

/**
 * 标记某个订单相关的通知为已读
 */
export const markOrderNotificationsAsReadController = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user!;
    const { orderId } = req.params;

    const count = await markOrderNotificationsAsRead(user.userId, Number(orderId));

    res.json({
      message: '相关通知已标记为已读',
      count,
    });
  } catch (error) {
    console.error('按订单标记通知为已读错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

/**
 * 删除通知
 */
export const deleteNotificationById = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    await deleteNotification(Number(id), user.userId);

    res.json({
      message: '通知删除成功',
    });
  } catch (error: any) {
    if (error.message === '通知不存在或无权删除') {
      return res.status(404).json({ error: error.message });
    }
    console.error('删除通知错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 批量删除通知
export const deleteNotificationsBatch = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user!;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '请提供要删除的通知ID数组' });
    }

    const deletedCount = await deleteNotifications(ids, user.userId);

    res.json({
      message: `成功删除 ${deletedCount} 条通知`,
      deleted_count: deletedCount,
    });
  } catch (error: any) {
    console.error('批量删除通知错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

