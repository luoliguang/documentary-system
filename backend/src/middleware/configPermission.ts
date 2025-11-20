import { NextFunction, Response } from 'express';
import { AuthRequest } from './auth.js';
import {
  canManageConfigScope,
  ConfigScope,
} from '../services/configPermissionService.js';
import { ErrorFactory } from '../errors/AppError.js';

export function requireConfigPermission(scope: ConfigScope) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        throw ErrorFactory.unauthorized('未登录');
      }
      const allowed = await canManageConfigScope(user.role, scope);
      if (!allowed) {
        throw ErrorFactory.forbidden('您没有权限执行该配置操作');
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

