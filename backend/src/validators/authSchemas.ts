/**
 * 认证相关的验证 Schema
 */
import { z } from 'zod';

/**
 * 登录验证 Schema
 */
export const loginSchema = z.object({
  account: z.string().min(1, '账号不能为空').max(100, '账号不能超过100个字符'),
  password: z.string().min(1, '密码不能为空').max(200, '密码不能超过200个字符'),
});

/**
 * 修改密码验证 Schema
 */
export const changePasswordSchema = z
  .object({
    old_password: z.string().trim().min(1, '旧密码不能为空'),
    new_password: z
      .string()
      .trim()
      .min(6, '新密码至少6个字符')
      .max(200, '密码不能超过200个字符'),
  })
  .refine(
    (data) => data.old_password !== data.new_password,
    { message: '新密码不能与旧密码相同', path: ['new_password'] }
  );

