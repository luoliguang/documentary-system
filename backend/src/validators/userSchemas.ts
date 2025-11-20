/**
 * 用户相关的验证 Schema
 */
import { z } from 'zod';

/**
 * 创建用户验证 Schema
 */
export const createUserSchema = z.object({
  username: z.string().min(1, '用户名不能为空').max(100, '用户名不能超过100个字符'),
  password: z.string().min(6, '密码至少6个字符').max(200, '密码不能超过200个字符'),
  role: z.enum(['admin', 'customer', 'production_manager'], {
    errorMap: () => ({ message: '角色必须是 admin、customer 或 production_manager' }),
  }),
  customer_code: z.string().max(50, '客户编号不能超过50个字符').optional().nullable(),
  company_name: z.string().max(200, '公司名称不能超过200个字符').optional().nullable(),
  contact_name: z.string().max(100, '联系人姓名不能超过100个字符').optional().nullable(),
  email: z.string().email('邮箱格式不正确').optional().nullable(),
  phone: z.string().max(20, '电话号码不能超过20个字符').optional().nullable(),
  assigned_order_types: z.array(z.string()).optional().default([]),
  admin_notes: z.string().max(5000, '管理员备注不能超过5000个字符').optional().nullable(),
});

/**
 * 更新用户验证 Schema
 */
export const updateUserSchema = z.object({
  username: z.string().min(1, '用户名不能为空').max(100, '用户名不能超过100个字符').optional(),
  password: z.string().min(6, '密码至少6个字符').max(200, '密码不能超过200个字符').optional(),
  role: z.enum(['admin', 'customer', 'production_manager'], {
    errorMap: () => ({ message: '角色必须是 admin、customer 或 production_manager' }),
  }).optional(),
  customer_code: z.string().max(50, '客户编号不能超过50个字符').optional().nullable(),
  company_name: z.string().max(200, '公司名称不能超过200个字符').optional().nullable(),
  contact_name: z.string().max(100, '联系人姓名不能超过100个字符').optional().nullable(),
  email: z.string().email('邮箱格式不正确').optional().nullable(),
  phone: z.string().max(20, '电话号码不能超过20个字符').optional().nullable(),
  assigned_order_types: z.array(z.string()).optional(),
  admin_notes: z.string().max(5000, '管理员备注不能超过5000个字符').optional().nullable(),
  is_active: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: '至少需要提供一个要更新的字段' }
);

