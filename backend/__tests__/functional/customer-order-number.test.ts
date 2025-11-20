import { setMockUser } from './testUtils/mockAuth.js';
import { mockDbQuery } from './testUtils/mockDb.js';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('核心功能：客户提交客户订单编号', () => {
  beforeEach(() => {
    setMockUser({ userId: 301, role: 'customer', username: '客户丙' });
    mockDbQuery.mockReset();
  });

  it('成功：客户可为自己的订单补录编号', async () => {
    mockDbQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 600,
            customer_id: 301,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 600,
            customer_order_number: 'C-2024-01',
          },
        ],
      });

    const response = await request(app)
      .patch('/api/orders/600/customer-order-number')
      .send({ customer_order_number: 'C-2024-01' });

    expect(response.status).toBe(200);
    expect(response.body.order.customer_order_number).toBe('C-2024-01');
  });

  it('边界：订单不存在或不属于客户返回404', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .patch('/api/orders/999/customer-order-number')
      .send({ customer_order_number: 'X-1' });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('订单不存在或无权访问');
  });

  it('权限：非客户角色被拒绝', async () => {
    setMockUser({ userId: 1, role: 'admin', username: '管理员' });

    const response = await request(app)
      .patch('/api/orders/600/customer-order-number')
      .send({ customer_order_number: 'X-1' });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('需要客户权限');
  });

  it('校验：缺少 customer_order_number 字段直接返回400', async () => {
    const response = await request(app)
      .patch('/api/orders/600/customer-order-number')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('请求数据验证失败');
    expect(response.body.details?.[0]?.field).toBe('customer_order_number');
  });
});


