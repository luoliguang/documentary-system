/**
 * 订单相关的验证 Schema
 */
import { z } from 'zod';
import { ORDER_STATUS } from '../constants/orderStatus.js';
import { ORDER_TYPE } from '../constants/orderType.js';

// 订单编号验证（工厂订单编号）
const orderNumberSchema = z.string().min(1, '订单编号不能为空').max(100, '订单编号不能超过100个字符');

// 客户订单编号验证
const customerOrderNumberSchema = z.string().max(100, '客户订单编号不能超过100个字符').optional().nullable();

const dateTimeStringSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/,
  '日期时间格式不正确（应为 YYYY-MM-DD HH:mm:ss 或 YYYY-MM-DDTHH:mm:ss）'
);

// 日期时间验证（接受 ISO 8601 字符串、空格分隔字符串或 Date 对象）
const timestampSchema = z.union([
  z.string().datetime(),
  dateTimeStringSchema,
  z.date(),
]).optional().nullable();

// 日期验证（仅日期，不含时间）
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式不正确（应为 YYYY-MM-DD）').optional().nullable();

// 图片数组验证
const imagesArraySchema = z.array(z.string().url('图片URL格式不正确'));
const imagesCreateSchema = imagesArraySchema.optional().default([]);
const imagesUpdateSchema = imagesArraySchema.optional();

// 发货单号数组验证
const shippingTrackingNumbersArraySchema = z.array(
  z.object({
    type: z.string().min(1, '发货单类型不能为空'),
    number: z.string().min(1, '发货单号不能为空'),
    label: z.string().optional(),
  })
);
const shippingTrackingNumbersCreateSchema = shippingTrackingNumbersArraySchema
  .optional()
  .default([]);
const shippingTrackingNumbersUpdateSchema =
  shippingTrackingNumbersArraySchema.optional();

// 动态订单状态/类型值验证
const orderStatusValueSchema = z
  .string()
  .min(1, '订单状态不能为空')
  .max(50, '订单状态不能超过50个字符');

const orderTypeValueSchema = z
  .string()
  .min(1, '订单类型不能为空')
  .max(50, '订单类型不能超过50个字符');

/**
 * 创建订单验证 Schema
 */
export const createOrderSchema = z.object({
  order_number: orderNumberSchema,
  customer_id: z.number().int().positive('客户ID必须是正整数'),
  customer_code: z.string().max(50, '客户编号不能超过50个字符').optional(),
  customer_order_number: customerOrderNumberSchema,
  status: orderStatusValueSchema.optional().default(ORDER_STATUS.PENDING),
  order_type: orderTypeValueSchema.optional().default(ORDER_TYPE.REQUIRED),
  notes: z
    .string()
    .max(5000, '备注不能超过5000个字符')
    .optional()
    .nullable(),
  internal_notes: z
    .string()
    .max(5000, '内部备注不能超过5000个字符')
    .optional()
    .nullable(),
  estimated_ship_date: timestampSchema,
  order_date: z
    .union([z.string().datetime(), dateTimeStringSchema, z.date()])
    .refine(
      (date) => {
        if (!date) return false;
        const orderDate = new Date(date);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return orderDate <= today;
      },
      { message: '下单时间不能晚于当前日期' }
    ),
  images: imagesCreateSchema,
  shipping_tracking_numbers: shippingTrackingNumbersCreateSchema,
});

/**
 * 更新订单验证 Schema
 */
export const updateOrderSchema = z
  .object({
    status: orderStatusValueSchema.optional(),
    is_completed: z.boolean().optional(),
    can_ship: z.boolean().optional(),
    estimated_ship_date: timestampSchema,
    actual_ship_date: dateSchema,
    order_date: z
      .union([z.string().datetime(), dateTimeStringSchema, z.date()])
      .refine(
        (date) => {
          if (!date) return true; // 可选字段，如果为空则通过
          const orderDate = new Date(date);
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          return orderDate <= today;
        },
        { message: '下单时间不能晚于当前日期' }
      )
      .optional()
      .nullable(),
    notes: z
      .string()
      .max(5000, '备注不能超过5000个字符')
      .optional()
      .nullable(),
    internal_notes: z
      .string()
      .max(5000, '内部备注不能超过5000个字符')
      .optional()
      .nullable(),
    order_number: orderNumberSchema.optional(),
    customer_order_number: customerOrderNumberSchema,
    customer_id: z.number().int().positive('客户ID必须是正整数').optional(),
    order_type: orderTypeValueSchema.optional(),
    images: imagesUpdateSchema,
    shipping_tracking_numbers: shippingTrackingNumbersUpdateSchema,
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: '至少需要提供一个要更新的字段' }
  );

/**
 * 更新客户订单编号验证 Schema
 */
export const updateCustomerOrderNumberSchema = z.object({
  customer_order_number: z.string().min(1, '客户订单编号不能为空').max(100, '客户订单编号不能超过100个字符'),
});

/**
 * 完成任务验证 Schema
 */
export const completeOrderSchema = z.object({
  notes: z.string().max(5000, '备注不能超过5000个字符').optional().nullable(),
});

/**
 * 分配订单验证 Schema
 */
export const assignOrderSchema = z.object({
  assigned_to: z.number().int().positive('生产跟单ID必须是正整数').optional().nullable(),
  assigned_to_ids: z.array(z.number().int().positive('生产跟单ID必须是正整数')).optional(),
  primary_assigned_to: z.number().int().positive('主负责人ID必须是正整数').optional().nullable(),
}).refine(
  (data) => data.assigned_to_ids !== undefined || data.assigned_to !== undefined,
  { message: '请提供分配目标（使用 assigned_to_ids 或 assigned_to 字段）' }
).refine(
  (data) => {
    if (data.primary_assigned_to == null) return true;
    if (Array.isArray(data.assigned_to_ids) && data.assigned_to_ids.length > 0) {
      return data.assigned_to_ids.includes(data.primary_assigned_to);
    }
    if (data.assigned_to !== undefined && data.assigned_to !== null) {
      return data.primary_assigned_to === data.assigned_to;
    }
    return false;
  },
  { message: '主负责人必须包含在分配的生产跟单列表中' }
);

/**
 * 订单查询参数验证 Schema
 */
export const getOrdersQuerySchema = z.object({
  customer_id: z.string().regex(/^\d+$/, '客户ID必须是数字').optional(),
  customer_code: z.string().max(50, '客户编号不能超过50个字符').optional(),
  order_number: z.string().max(100, '订单编号不能超过100个字符').optional(),
  customer_order_number: z
    .string()
    .max(100, '客户订单编号不能超过100个字符')
    .optional(),
  status: orderStatusValueSchema.optional(),
  order_type: orderTypeValueSchema.optional(),
  is_completed: z
    .string()
    .regex(/^(true|false)$/, 'is_completed 必须是 true 或 false')
    .optional(),
  can_ship: z
    .string()
    .regex(/^(true|false)$/, 'can_ship 必须是 true 或 false')
    .optional(),
  company_name: z.string().max(200, '公司名称不能超过200个字符').optional(),
  estimated_ship_start: timestampSchema,
  estimated_ship_end: timestampSchema,
  page: z.string().regex(/^\d+$/, '页码必须是数字').optional().default('1'),
  pageSize: z
    .string()
    .regex(/^\d+$/, '每页数量必须是数字')
    .optional()
    .default('20'),
});

