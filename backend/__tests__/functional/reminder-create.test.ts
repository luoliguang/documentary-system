import { setMockUser } from './testUtils/mockAuth.js';
import { mockDbQuery } from './testUtils/mockDb.js';
import request from 'supertest';
import { createApp } from '../../src/app.js';

jest.mock('../../src/services/configService.js', () => ({
  configService: {
    getConfig: jest.fn(),
  },
}));

const configModule = jest.requireMock('../../src/services/configService.js') as {
  configService: { getConfig: jest.Mock };
};

const mockConfigService = configModule.configService;

const notificationServiceMocks = {
  createNotificationsForUsers: jest.fn(),
  getAllAdminUserIds: jest.fn(),
  createNotification: jest.fn(),
};

jest.mock('../../src/services/notificationService.js', () => ({
  createNotificationsForUsers: (...args: any[]) =>
    notificationServiceMocks.createNotificationsForUsers(...args),
  getAllAdminUserIds: (...args: any[]) =>
    notificationServiceMocks.getAllAdminUserIds(...args),
  createNotification: (...args: any[]) =>
    notificationServiceMocks.createNotification(...args),
}));

const app = createApp();

describe('核心功能：客户催货', () => {
  beforeEach(() => {
    mockDbQuery.mockReset();
    mockConfigService.getConfig.mockReset();
    Object.values(notificationServiceMocks).forEach((fn) => fn.mockReset());
    setMockUser({ userId: 20, role: 'customer', username: '客户A' });
  });

  it('成功：客户提交催货后创建记录并推送通知', async () => {
    mockDbQuery
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // 校验订单归属
      .mockResolvedValueOnce({ rows: [] }) // 最近催货
      .mockResolvedValueOnce({
        rows: [
          {
            order_number: 'FD-500',
            customer_order_number: 'CO-1',
            company_name: '方度',
            contact_name: '联系人',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 888,
            order_id: 1,
            customer_id: 20,
            reminder_type: 'normal',
            message: '请加急',
          },
        ],
      });

    notificationServiceMocks.getAllAdminUserIds.mockResolvedValue([1, 2]);
    notificationServiceMocks.createNotificationsForUsers.mockResolvedValue(undefined);

    const response = await request(app).post('/api/reminders').send({
      order_id: 1,
      reminder_type: 'normal',
      message: '请加急',
    });

    expect(response.status).toBe(201);
    expect(response.body.reminder).toMatchObject({
      id: 888,
      order_id: 1,
      customer_id: 20,
    });
    expect(notificationServiceMocks.createNotificationsForUsers).toHaveBeenCalledWith(
      [1, 2],
      expect.objectContaining({
        type: 'reminder',
        related_id: 1,
      })
    );
  });

  it('边界：距离上次催货未到配置间隔返回429', async () => {
    mockDbQuery
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({
        rows: [{ created_at: '2024-01-01T00:30:00.000Z' }],
      });
    mockConfigService.getConfig.mockResolvedValue(2);

    const response = await request(app).post('/api/reminders').send({
      order_id: 1,
      reminder_type: 'urgent',
    });

    expect(response.status).toBe(429);
    expect(response.body.error).toContain('催货过于频繁');
    expect(response.body.interval_hours).toBe(2);
  });

  it('权限：非客户角色被requireCustomer拒绝', async () => {
    setMockUser({ userId: 1, role: 'admin', username: '管理员' });

    const response = await request(app).post('/api/reminders').send({
      order_id: 1,
      reminder_type: 'normal',
    });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('需要客户权限');
  });
});


