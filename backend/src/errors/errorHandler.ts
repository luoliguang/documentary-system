/**
 * 统一错误处理中间件和工具函数
 */
import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode } from './AppError.js';
import { JwtPayload } from '../types/index.js';

type RequestWithUser = Request & {
  user?: JwtPayload;
};

/**
 * 错误响应格式接口
 */
export interface ErrorResponse {
  error: string;
  errorCode?: number;
  details?: any;
  timestamp?: string;
  path?: string;
}

/**
 * 判断是否为可操作错误（AppError）
 */
export function isAppError(error: any): error is AppError {
  return error instanceof AppError;
}

/**
 * 判断是否为数据库错误
 */
export function isDatabaseError(error: any): boolean {
  return error && error.code && typeof error.code === 'string' && error.code.startsWith('23');
}

/**
 * 判断是否为唯一约束违反错误
 */
export function isUniqueConstraintError(error: any): boolean {
  return error && error.code === '23505';
}

/**
 * 判断是否为外键约束违反错误
 */
export function isForeignKeyConstraintError(error: any): boolean {
  return error && error.code === '23503';
}

/**
 * 格式化错误响应
 */
export function formatErrorResponse(error: AppError | Error, req?: RequestWithUser): ErrorResponse {
  const response: ErrorResponse = {
    error: error.message || '服务器内部错误',
    timestamp: new Date().toISOString(),
  };

  if (isAppError(error)) {
    response.errorCode = error.errorCode;
    if (error.details) {
      response.details = error.details;
    }
  }

  if (req) {
    response.path = req.path;
  }

  // 生产环境不返回错误代码和详细信息
  if (process.env.NODE_ENV === 'production' && !isAppError(error)) {
    response.error = '服务器内部错误';
    delete response.errorCode;
    delete response.details;
  }

  return response;
}

/**
 * 记录错误日志
 */
export function logError(error: Error | AppError, req?: RequestWithUser): void {
  const isAppErr = isAppError(error);
  const isOperational = isAppErr ? error.isOperational : false;
  const logLevel = isOperational ? 'warn' : 'error';

  const logData: any = {
    message: error.message,
    stack: error.stack,
  };

  if (isAppErr) {
    logData.errorCode = error.errorCode;
    logData.statusCode = error.statusCode;
    logData.details = error.details;
  }

  if (req) {
    logData.method = req.method;
    logData.path = req.path;
    logData.ip = req.ip;
    logData.userAgent = req.get('user-agent');
    if (req.user) {
      logData.userId = req.user.userId;
      logData.role = req.user.role;
    }
  }

  if (logLevel === 'error') {
    console.error('[错误日志]', JSON.stringify(logData, null, 2));
  } else {
    console.warn('[警告日志]', JSON.stringify(logData, null, 2));
  }
}

/**
 * 全局错误处理中间件
 * 必须放在所有路由之后
 */
export function errorHandler(
  error: Error | AppError,
  req: RequestWithUser,
  res: Response,
  next: NextFunction
): void {
  // 如果响应已经发送，委托给 Express 默认错误处理
  if (res.headersSent) {
    return next(error);
  }

  // 记录错误日志
  logError(error, req);

  // 处理 AppError
  if (isAppError(error)) {
    const response = formatErrorResponse(error, req);
    res.status(error.statusCode).json(response);
    return;
  }

  // 处理数据库错误
  if (isUniqueConstraintError(error)) {
    const appError = new AppError(
      '数据已存在，请检查唯一性约束',
      400,
      ErrorCode.VALIDATION_ERROR,
      true,
      { constraint: (error as any).constraint }
    );
    const response = formatErrorResponse(appError, req);
    res.status(400).json(response);
    return;
  }

  if (isForeignKeyConstraintError(error)) {
    const appError = new AppError(
      '关联数据不存在，请检查外键约束',
      400,
      ErrorCode.VALIDATION_ERROR,
      true,
      { constraint: (error as any).constraint }
    );
    const response = formatErrorResponse(appError, req);
    res.status(400).json(response);
    return;
  }

  // 处理其他未知错误
  const response = formatErrorResponse(error, req);
  res.status(500).json(response);
}

/**
 * 异步错误处理包装器
 * 用于包装异步路由处理器，自动捕获 Promise 拒绝
 */
export function asyncHandler(
  fn: (req: RequestWithUser, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: RequestWithUser, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 错误处理中间件
 * 必须放在所有路由之后，错误处理中间件之前
 */
export function notFoundHandler(
  req: RequestWithUser,
  res: Response,
  next: NextFunction
): void {
  const error = new AppError(
    `路径 ${req.originalUrl} 不存在`,
    404,
    ErrorCode.NOT_FOUND
  );
  next(error);
}

