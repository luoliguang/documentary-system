/**
 * 应用程序自定义错误类
 * 用于统一错误处理和错误响应格式
 */

export enum ErrorCode {
  // 通用错误 (1000-1999)
  INTERNAL_ERROR = 1000,
  VALIDATION_ERROR = 1001,
  NOT_FOUND = 1002,
  UNAUTHORIZED = 1003,
  FORBIDDEN = 1004,
  BAD_REQUEST = 1005,

  // 认证错误 (2000-2999)
  INVALID_CREDENTIALS = 2000,
  TOKEN_EXPIRED = 2001,
  TOKEN_INVALID = 2002,

  // 业务错误 (3000-3999)
  ORDER_NOT_FOUND = 3000,
  ORDER_ALREADY_EXISTS = 3001,
  ORDER_INVALID_STATUS = 3002,
  CUSTOMER_NOT_FOUND = 3003,
  REMINDER_NOT_FOUND = 3004,
  FOLLOW_UP_NOT_FOUND = 3005,
  USER_NOT_FOUND = 3006,
  PERMISSION_DENIED = 3007,
  INVALID_ORDER_DATE = 3008,
  REMINDER_THROTTLED = 3009,
}

export interface ErrorDetails {
  [key: string]: any;
}

/**
 * 应用程序错误类
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: ErrorCode;
  public readonly isOperational: boolean;
  public readonly details?: ErrorDetails;

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode: ErrorCode = ErrorCode.INTERNAL_ERROR,
    isOperational: boolean = true,
    details?: ErrorDetails
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.details = details;

    // 保持正确的堆栈跟踪
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 错误工厂函数
 */
export class ErrorFactory {
  // 通用错误
  static internalError(message: string = '服务器内部错误', details?: ErrorDetails): AppError {
    return new AppError(message, 500, ErrorCode.INTERNAL_ERROR, false, details);
  }

  static validationError(message: string, details?: ErrorDetails): AppError {
    return new AppError(message, 400, ErrorCode.VALIDATION_ERROR, true, details);
  }

  static notFound(message: string = '资源不存在', details?: ErrorDetails): AppError {
    return new AppError(message, 404, ErrorCode.NOT_FOUND, true, details);
  }

  static unauthorized(message: string = '未授权访问', details?: ErrorDetails): AppError {
    return new AppError(message, 401, ErrorCode.UNAUTHORIZED, true, details);
  }

  static forbidden(message: string = '无权访问', details?: ErrorDetails): AppError {
    return new AppError(message, 403, ErrorCode.FORBIDDEN, true, details);
  }

  static badRequest(message: string, details?: ErrorDetails): AppError {
    return new AppError(message, 400, ErrorCode.BAD_REQUEST, true, details);
  }

  // 认证错误
  static invalidCredentials(message: string = '账号或密码错误'): AppError {
    return new AppError(message, 401, ErrorCode.INVALID_CREDENTIALS, true);
  }

  static tokenExpired(message: string = 'Token已过期'): AppError {
    return new AppError(message, 401, ErrorCode.TOKEN_EXPIRED, true);
  }

  static tokenInvalid(message: string = 'Token无效'): AppError {
    return new AppError(message, 401, ErrorCode.TOKEN_INVALID, true);
  }

  // 业务错误
  static orderNotFound(orderId?: number): AppError {
    return new AppError(
      '订单不存在',
      404,
      ErrorCode.ORDER_NOT_FOUND,
      true,
      orderId ? { orderId } : undefined
    );
  }

  static orderAlreadyExists(orderNumber: string): AppError {
    return new AppError(
      '订单编号已存在',
      400,
      ErrorCode.ORDER_ALREADY_EXISTS,
      true,
      { orderNumber }
    );
  }

  static customerNotFound(customerId?: number): AppError {
    return new AppError(
      '客户不存在',
      404,
      ErrorCode.CUSTOMER_NOT_FOUND,
      true,
      customerId ? { customerId } : undefined
    );
  }

  static reminderNotFound(reminderId?: number): AppError {
    return new AppError(
      '催货记录不存在',
      404,
      ErrorCode.REMINDER_NOT_FOUND,
      true,
      reminderId ? { reminderId } : undefined
    );
  }

  static followUpNotFound(followUpId?: number): AppError {
    return new AppError(
      '跟进记录不存在',
      404,
      ErrorCode.FOLLOW_UP_NOT_FOUND,
      true,
      followUpId ? { followUpId } : undefined
    );
  }

  static userNotFound(userId?: number): AppError {
    return new AppError(
      '用户不存在',
      404,
      ErrorCode.USER_NOT_FOUND,
      true,
      userId ? { userId } : undefined
    );
  }

  static permissionDenied(message: string = '您没有权限执行此操作', details?: ErrorDetails): AppError {
    return new AppError(message, 403, ErrorCode.PERMISSION_DENIED, true, details);
  }

  static invalidOrderDate(message: string = '下单时间不能晚于当前日期'): AppError {
    return new AppError(message, 400, ErrorCode.INVALID_ORDER_DATE, true);
  }

  static reminderThrottled(intervalHours: number): AppError {
    return new AppError(
      `催货过于频繁，请等待 ${intervalHours} 小时后再试`,
      429,
      ErrorCode.REMINDER_THROTTLED,
      true,
      { intervalHours }
    );
  }
}

