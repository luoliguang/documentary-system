/**
 * 验证中间件
 * 使用 Zod 进行请求数据验证
 */
import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

/**
 * 验证请求体的中间件工厂函数
 * @param schema Zod schema
 * @returns Express 中间件
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 验证并转换请求体
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // 格式化 Zod 错误信息
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        return res.status(400).json({
          error: '请求数据验证失败',
          details: errors,
        });
      }

      // 其他错误
      console.error('验证中间件错误:', error);
      return res.status(500).json({ error: '服务器内部错误' });
    }
  };
}

/**
 * 验证查询参数的中间件工厂函数
 * @param schema Zod schema
 * @returns Express 中间件
 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 验证并转换查询参数
      req.query = await schema.parseAsync(req.query) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // 格式化 Zod 错误信息
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        return res.status(400).json({
          error: '查询参数验证失败',
          details: errors,
        });
      }

      // 其他错误
      console.error('验证中间件错误:', error);
      return res.status(500).json({ error: '服务器内部错误' });
    }
  };
}

/**
 * 验证路径参数的中间件工厂函数
 * @param schema Zod schema
 * @returns Express 中间件
 */
export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 验证并转换路径参数
      req.params = await schema.parseAsync(req.params) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // 格式化 Zod 错误信息
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        return res.status(400).json({
          error: '路径参数验证失败',
          details: errors,
        });
      }

      // 其他错误
      console.error('验证中间件错误:', error);
      return res.status(500).json({ error: '服务器内部错误' });
    }
  };
}

