/**
 * 催货相关的验证 Schema
 */
import { z } from 'zod';

/**
 * 创建催货记录验证 Schema
 */
export const createReminderSchema = z.object({
  order_id: z.union([
    z.number().int().positive('订单ID必须是正整数'),
    z.string().regex(/^\d+$/, '订单ID必须是数字').transform(Number),
  ]),
  reminder_type: z.enum(['normal', 'urgent'], {
    errorMap: () => ({ message: '催货类型必须是 normal 或 urgent' }),
  }).optional().default('normal'),
  message: z.string().max(1000, '催货消息不能超过1000个字符').optional().nullable(),
});

/**
 * 回复催货记录验证 Schema（管理员）
 */
export const respondReminderSchema = z.object({
  admin_response: z
    .string()
    .min(1, '回复内容不能为空')
    .max(5000, '回复内容不能超过5000个字符'),
  is_resolved: z.boolean().optional(),
});

export const requestPermissionSchema = z.object({
  target_pm_id: z.union([
    z.number().int().positive('目标生产跟单ID必须是正整数'),
    z.string().regex(/^\d+$/, '目标生产跟单ID必须是数字').transform(Number),
  ]),
  order_type: z.string().max(100).optional(),
  reason: z.string().max(1000, '备注不能超过1000个字符').optional(),
});

