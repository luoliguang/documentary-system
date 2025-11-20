import { setMockUser } from './testUtils/mockAuth.js';
import permissionServiceMocks from './testUtils/mockPermissionService.js';
import { mockDbQuery } from './testUtils/mockDb.js';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('核心功能：创建订单', () => {
  beforeEach(() => {
    mockDbQuery.mockReset();
    permissionServiceMocks.canCreateOrder.mockReset();
    setMockUser({ userId: 1, role: 'admin', username: 'Admin' });
  });

  it('成功创建订单：管理员+合法数据返回201', async () => {
    permissionServiceMocks.canCreateOrder.mockResolvedValue(true);

    mockDbQuery
      .mockResolvedValueOnce({ rows: [] }) // 检查订单编号
      .mockResolvedValueOnce({ rows: [{ id: 10, customer_code: 'C001' }] }) // 查询客户
      .mockResolvedValueOnce({
        rows: [
          {
            id: 100,
            order_number: 'FD-001',
            status: 'pending',
            customer_id: 10,
            customer_code: 'C001',
          },
        ],
      }) // 创建订单
      .mockResolvedValueOnce({ rows: [] }); // 写入状态历史

    const response = await request(app).post('/api/orders').send({
      order_number: 'FD-001',
      customer_id: 10,
      order_date: '2023-12-01T10:00:00.000Z',
      notes: '首单',
    });

    expect(response.status).toBe(201);
    expect(response.body.order).toMatchObject({
      id: 100,
      order_number: 'FD-001',
      customer_id: 10,
    });
    expect(permissionServiceMocks.canCreateOrder).toHaveBeenCalledWith('admin');
    expect(mockDbQuery).toHaveBeenCalledTimes(4);
  });

  it('边界：order_date 晚于当前日期触发400验证错误', async () => {
    const response = await request(app).post('/api/orders').send({
      order_number: 'FD-002',
      customer_id: 12,
      order_date: '2030-01-01T10:00:00.000Z',
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('请求数据验证失败');
    expect(response.body.details?.[0]?.message).toContain('下单时间不能晚于当前日期');
  });

  it('权限：非管理员被requireAdmin直接拒绝', async () => {
    setMockUser({ userId: 2, role: 'customer', username: '客户A' });

    const response = await request(app).post('/api/orders').send({
      order_number: 'FD-003',
      customer_id: 12,
      order_date: '2023-11-01T08:00:00.000Z',
    });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('需要管理员权限');
    expect(permissionServiceMocks.canCreateOrder).not.toHaveBeenCalled();
  });
});


