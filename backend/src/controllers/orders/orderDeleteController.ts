/**
 * 订单删除控制器
 * 负责订单删除相关的操作
 */

import { Response } from 'express';
import { pool } from '../../config/database.js';
import { AuthRequest } from '../../middleware/auth.js';
import { canDeleteOrder } from '../../services/permissionService.js';
import { deleteImagesFromOSS } from '../../services/ossService.js';

/**
 * 删除订单（仅管理员）
 */
export const deleteOrder = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    // 使用权限服务检查删除权限
    const canDelete = await canDeleteOrder(user.role);
    if (!canDelete) {
      return res.status(403).json({ error: '您没有权限删除订单' });
    }

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

