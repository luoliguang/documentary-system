import { mockDbQuery } from './testUtils/mockDb.js';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { comparePassword } from '../../src/utils/password.js';
import { generateToken } from '../../src/utils/jwt.js';

jest.mock('../../src/utils/password.js', () => ({
  __esModule: true,
  comparePassword: jest.fn(),
  hashPassword: jest.fn(),
}));

jest.mock('../../src/utils/jwt.js', () => ({
  __esModule: true,
  generateToken: jest.fn(),
}));

const app = createApp();

describe('核心功能：用户登录', () => {
  beforeEach(() => {
    mockDbQuery.mockReset();
    (comparePassword as jest.Mock).mockReset();
    (generateToken as jest.Mock).mockReset();
  });

  it('成功登录：账号密码正确返回token与用户信息', async () => {
    mockDbQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          username: '管理员',
          account: 'admin',
          role: 'admin',
          customer_code: null,
          password_hash: 'hashed',
        },
      ],
    });
    (comparePassword as jest.Mock).mockResolvedValue(true);
    (generateToken as jest.Mock).mockReturnValue('token-123');

    const response = await request(app).post('/api/auth/login').send({
      account: 'admin',
      password: 'secret',
    });

    expect(response.status).toBe(200);
    expect(response.body.token).toBe('token-123');
    expect(response.body.user).toMatchObject({
      id: 1,
      username: '管理员',
      role: 'admin',
    });
    expect(mockDbQuery).toHaveBeenCalledTimes(1);
  });

  it('边界：账号不存在时返回401', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [] });

    const response = await request(app).post('/api/auth/login').send({
      account: 'ghost',
      password: 'secret',
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toContain('账号或密码错误');
  });

  it('校验：缺少账号字段返回400并给出验证信息', async () => {
    const response = await request(app).post('/api/auth/login').send({
      password: 'secret',
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('请求数据验证失败');
    expect(response.body.details?.[0]?.field).toBe('account');
  });
});


