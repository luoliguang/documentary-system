import { setMockUser } from './testUtils/mockAuth.js';
import { mockDbQuery } from './testUtils/mockDb.js';
import notificationServiceMocks from './testUtils/mockNotificationService.js';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('核心功能：管理员回复催单', () => {
  beforeEach(() => {
    setMockUser({ userId: 401, role: 'admin', username: '管理员A' });
    mockDbQuery.mockReset();
    Object.values(notificationServiceMocks).forEach((fn) => fn.mockReset?.());
  });

  it('成功：回复内容被保存并通知客户', async () => {
    mockDbQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 50,
            order_id: 10,
            customer_id: 20,
            is_deleted: false,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 50,
            admin_response: '已安排生产',
            is_resolved: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            order_number: 'FD-10',
            customer_order_number: 'C-10',
            company_name: '方度',
            contact_name: '客户联系人',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            username: '管理员A',
            company_name: '',
            role: 'admin',
          },
        ],
      });

    const response = await request(app).patch('/api/reminders/50/respond').send({
      admin_response: '已安排生产',
      is_resolved: true,
    });

    expect(response.status).toBe(200);
    expect(response.body.reminder.admin_response).toBe('已安排生产');
    expect(notificationServiceMocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 20,
        related_id: 10,
      })
    );
  });

  it('边界：找不到催货记录返回404', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [] });

    const response = await request(app).patch('/api/reminders/999/respond').send({
      admin_response: '处理',
    });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('催货记录不存在');
  });

  it('边界：记录已删除无法回复', async () => {
    mockDbQuery.mockResolvedValueOnce({
      rows: [{ id: 1, order_id: 1, customer_id: 1, is_deleted: true }],
    });

    const response = await request(app).patch('/api/reminders/1/respond').send({
      admin_response: '处理',
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('催货记录已被删除，无法回复');
  });

  it('权限：非管理员被requireAdmin拦截', async () => {
    setMockUser({ userId: 500, role: 'production_manager', username: '跟单' });

    const response = await request(app).patch('/api/reminders/1/respond').send({
      admin_response: '处理',
    });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('需要管理员权限');
    expect(mockDbQuery).not.toHaveBeenCalled();
  });
});


