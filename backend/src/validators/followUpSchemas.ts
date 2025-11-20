/**
 * 跟进记录相关的验证 Schema
 */
import { z } from 'zod';

/**
 * 创建跟进记录验证 Schema
 */
export const createFollowUpSchema = z.object({
  order_id: z.union([
    z.number().int().positive('订单ID必须是正整数'),
    z.string().regex(/^\d+$/, '订单ID必须是数字').transform(Number),
  ]),
  content: z.string().min(1, '跟进内容不能为空').max(5000, '跟进内容不能超过5000个字符'),
  is_visible_to_customer: z.boolean().optional().default(true),
});

/**
 * 更新跟进记录验证 Schema
 */
export const updateFollowUpSchema = z.object({
  content: z.string().min(1, '跟进内容不能为空').max(5000, '跟进内容不能超过5000个字符').optional(),
  is_visible_to_customer: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: '至少需要提供一个要更新的字段' }
);

