import { setMockUser } from './testUtils/mockAuth.js';
import permissionServiceMocks from './testUtils/mockPermissionService.js';
import { mockDbQuery } from './testUtils/mockDb.js';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('核心功能：订单进度更新', () => {
  beforeEach(() => {
    mockDbQuery.mockReset();
    permissionServiceMocks.canUpdateOrder.mockReset();
    permissionServiceMocks.canUpdateOrderFieldByRole.mockReset();
    setMockUser({ userId: 5, role: 'production_manager', username: '生产跟单A' });
  });

  it('成功：生产跟单可更新允许字段并返回最新订单', async () => {
    permissionServiceMocks.canUpdateOrder.mockResolvedValue(true);
    permissionServiceMocks.canUpdateOrderFieldByRole.mockResolvedValue(true);

    mockDbQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 200,
            status: 'pending',
            is_completed: false,
            notes: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 200,
            status: 'pending',
            is_completed: true,
            notes: '完成车缝',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 200,
            order_number: 'FD-200',
            status: 'pending',
            is_completed: true,
            notes: '完成车缝',
            assigned_team: [],
          },
        ],
      });

    const response = await request(app)
      .put('/api/orders/200')
      .send({ is_completed: true, notes: '完成车缝' });

    expect(response.status).toBe(200);
    expect(response.body.order).toMatchObject({
      id: 200,
      is_completed: true,
      notes: '完成车缝',
    });
    expect(permissionServiceMocks.canUpdateOrder).toHaveBeenCalledWith(
      5,
      'production_manager',
      200
    );
    expect(permissionServiceMocks.canUpdateOrderFieldByRole).toHaveBeenCalledWith(
      'production_manager',
      'is_completed'
    );
  });

  it('边界：不提供任何字段触发400验证错误', async () => {
    const response = await request(app).put('/api/orders/201').send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('请求数据验证失败');
    expect(response.body.details?.[0]?.message).toContain('至少需要提供一个要更新的字段');
  });

  it('权限：canUpdateOrder 返回 false 时403拒绝', async () => {
    permissionServiceMocks.canUpdateOrder.mockResolvedValue(false);

    mockDbQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 300,
          status: 'pending',
        },
      ],
    });

    const response = await request(app)
      .put('/api/orders/300')
      .send({ notes: '尝试更新' });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('您没有权限更新此订单');
  });
});


