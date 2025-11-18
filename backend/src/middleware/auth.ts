import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { JwtPayload } from '../types/index.js';
import { pool } from '../config/database.js';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    
    // 验证用户是否被禁用
    try {
      const userResult = await pool.query(
        'SELECT is_active FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: '用户不存在' });
      }

      if (!userResult.rows[0].is_active) {
        return res.status(403).json({ error: '账号已被禁用' });
      }
    } catch (dbError) {
      console.error('验证用户状态错误:', dbError);
      return res.status(500).json({ error: '服务器内部错误' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: '无效的认证令牌' });
  }
};

// 管理员权限中间件
export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }

  next();
};

// 客户权限中间件（只能访问自己的数据）
export const requireCustomer = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: '需要客户权限' });
  }

  next();
};

