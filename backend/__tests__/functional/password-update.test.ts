import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { setMockUser } from './testUtils/mockAuth.js';
import { mockDbQuery } from './testUtils/mockDb.js';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { comparePassword, hashPassword } from '../../src/utils/password.js';

jest.mock('../../src/utils/password.js', () => ({
  __esModule: true,
  comparePassword: jest.fn(),
  hashPassword: jest.fn(),
}));
}));

describe('密码更新接口', () => {
  let app: ReturnType<typeof createApp>;
  const mockedComparePassword = jest.mocked(comparePassword);
  const mockedHashPassword = jest.mocked(hashPassword);

  beforeEach(() => {
    jest.clearAllMocks();
    setMockUser({ userId: 1, username: 'Admin', role: 'admin' });
    app = createApp();
  });

  it('成功：旧密码正确则更新并返回成功信息', async () => {
    mockDbQuery
      .mockResolvedValueOnce({ rows: [{ password_hash: 'hashed-old' }] })
      .mockResolvedValueOnce({ rows: [] });
    mockedComparePassword.mockResolvedValue(true);
    mockedHashPassword.mockResolvedValue('hashed-new');

    const response = await request(app).put('/api/auth/profile/password').send({
      old_password: 'old123',
      new_password: 'new12345',
    });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('密码修改成功');
    expect(hashPassword).toHaveBeenCalledWith('new12345');
    expect(mockDbQuery).toHaveBeenCalledTimes(2);
  });

  it('边界：旧密码错误返回400提示', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [{ password_hash: 'hashed-old' }] });
    mockedComparePassword.mockResolvedValue(false);

    const response = await request(app).put('/api/auth/profile/password').send({
      old_password: 'wrong',
      new_password: 'new12345',
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('旧密码错误');
    expect(mockDbQuery).toHaveBeenCalledTimes(1);
  });

  it('校验：新旧密码相同被验证器拦截', async () => {
    const response = await request(app).put('/api/auth/profile/password').send({
      old_password: 'same123',
      new_password: 'same123',
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('请求数据验证失败');
    expect(response.body.details?.[0]?.message).toBe('新密码不能与旧密码相同');
    expect(mockDbQuery).not.toHaveBeenCalled();
  });
});


