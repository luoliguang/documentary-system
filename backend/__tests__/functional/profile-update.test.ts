import { setMockUser, clearMockUser } from './testUtils/mockAuth.js';
import { mockDbQuery } from './testUtils/mockDb.js';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('核心功能：用户更新个人资料', () => {
  beforeEach(() => {
    setMockUser({ userId: 201, role: 'customer', username: '客户乙' });
    mockDbQuery.mockReset();
  });

  it('成功：提交部分字段即可更新并返回最新信息', async () => {
    mockDbQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 201,
          username: '客户乙',
          contact_name: '新联系人',
          email: 'new@example.com',
          phone: '13800138000',
        },
      ],
    });

    const response = await request(app).put('/api/auth/profile').send({
      contact_name: '新联系人',
      email: 'new@example.com',
    });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      contact_name: '新联系人',
      email: 'new@example.com',
    });
    expect(mockDbQuery).toHaveBeenCalledTimes(1);
  });

  it('边界：没有提交任何字段返回400', async () => {
    const response = await request(app).put('/api/auth/profile').send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('没有要更新的字段');
    expect(mockDbQuery).not.toHaveBeenCalled();
  });

  it('权限：未认证用户访问被拒绝', async () => {
    clearMockUser();

    const response = await request(app).put('/api/auth/profile').send({
      contact_name: 'test',
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('未提供认证令牌');
  });
});


