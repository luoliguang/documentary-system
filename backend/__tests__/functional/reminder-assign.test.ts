import { setMockUser } from './testUtils/mockAuth.js';
import { mockDbQuery } from './testUtils/mockDb.js';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('核心功能：管理员派送催单给生产跟单', () => {
  beforeEach(() => {
    setMockUser({ userId: 402, role: 'admin', username: '管理员B' });
    mockDbQuery.mockReset();
  });

  it('成功：指定生产跟单后记录被更新', async () => {
    mockDbQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 70,
            order_id: 10,
            is_deleted: false,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ role: 'production_manager' }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 70,
            assigned_to: 900,
            is_admin_assigned: true,
          },
        ],
      });

    const response = await request(app).post('/api/reminders/70/assign').send({
      assigned_to: 900,
    });

    expect(response.status).toBe(200);
    expect(response.body.reminder).toMatchObject({
      assigned_to: 900,
      is_admin_assigned: true,
    });
  });

  it('边界：指定的用户不是生产跟单返回400', async () => {
    mockDbQuery
      .mockResolvedValueOnce({
        rows: [{ id: 70, order_id: 10, is_deleted: false }],
      })
      .mockResolvedValueOnce({
        rows: [{ role: 'customer' }],
      });

    const response = await request(app).post('/api/reminders/70/assign').send({
      assigned_to: 1,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('指定的用户不是生产跟单');
  });

  it('边界：催货记录不存在返回404', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [] });

    const response = await request(app).post('/api/reminders/999/assign').send({
      assigned_to: 1,
    });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('催货记录不存在');
  });

  it('权限：非管理员无法派送', async () => {
    setMockUser({ userId: 20, role: 'customer', username: '客户' });

    const response = await request(app).post('/api/reminders/70/assign').send({
      assigned_to: 1,
    });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('需要管理员权限');
    expect(mockDbQuery).not.toHaveBeenCalled();
  });
});


