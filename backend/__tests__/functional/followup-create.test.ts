import { setMockUser } from './testUtils/mockAuth.js';
import permissionServiceMocks from './testUtils/mockPermissionService.js';
import { mockDbQuery } from './testUtils/mockDb.js';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const followUpServiceMocks = {
  createFollowUp: jest.fn(),
  getFollowUpsByOrderId: jest.fn(),
  getFollowUpById: jest.fn(),
  updateFollowUp: jest.fn(),
  deleteFollowUp: jest.fn(),
};

jest.mock('../../src/services/followUpService.js', () => ({
  createFollowUp: (...args: any[]) => followUpServiceMocks.createFollowUp(...args),
  getFollowUpsByOrderId: (...args: any[]) => followUpServiceMocks.getFollowUpsByOrderId(...args),
  getFollowUpById: (...args: any[]) => followUpServiceMocks.getFollowUpById(...args),
  updateFollowUp: (...args: any[]) => followUpServiceMocks.updateFollowUp(...args),
  deleteFollowUp: (...args: any[]) => followUpServiceMocks.deleteFollowUp(...args),
}));

const notificationServiceMocks = {
  createNotification: jest.fn(),
  getAllAdminUserIds: jest.fn(),
  createNotificationsForUsers: jest.fn(),
};

jest.mock('../../src/services/notificationService.js', () => ({
  createNotification: (...args: any[]) => notificationServiceMocks.createNotification(...args),
  getAllAdminUserIds: (...args: any[]) => notificationServiceMocks.getAllAdminUserIds(...args),
  createNotificationsForUsers: (...args: any[]) =>
    notificationServiceMocks.createNotificationsForUsers(...args),
}));

const app = createApp();

describe('核心功能：生产跟单创建跟进记录', () => {
  beforeEach(() => {
    mockDbQuery.mockReset();
    Object.values(followUpServiceMocks).forEach((fn) => fn.mockReset());
    Object.values(notificationServiceMocks).forEach((fn) => fn.mockReset());
    permissionServiceMocks.canCreateFollowUp.mockReset();
    setMockUser({ userId: 30, role: 'production_manager', username: '跟单A' });
  });

  it('成功：生产跟单创建客户可见的跟进记录', async () => {
    permissionServiceMocks.canCreateFollowUp.mockResolvedValue(true);

    mockDbQuery
      .mockResolvedValueOnce({
        rows: [
          {
            order_number: 'FD-900',
            customer_id: 50,
            company_name: '方度',
            contact_name: '联系人',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            is_completed: false,
            can_ship: false,
            estimated_ship_date: '2024-01-10T00:00:00.000Z',
            status: 'assigned',
          },
        ],
      });

    followUpServiceMocks.createFollowUp.mockResolvedValue({
      id: 700,
      order_id: 1,
      production_manager_id: 30,
      content: '已安排裁床',
      is_visible_to_customer: true,
    });
    notificationServiceMocks.getAllAdminUserIds.mockResolvedValue([1]);

    const response = await request(app).post('/api/follow-ups').send({
      order_id: 1,
      content: '已安排裁床',
      is_visible_to_customer: true,
    });

    expect(response.status).toBe(201);
    expect(response.body.followUp).toMatchObject({
      id: 700,
      order_id: 1,
      content: '已安排裁床',
    });
    expect(notificationServiceMocks.getAllAdminUserIds).toHaveBeenCalled();
    expect(notificationServiceMocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 50,
        related_id: 1,
      })
    );
  });

  it('边界：缺少content字段触发400验证错误', async () => {
    const response = await request(app).post('/api/follow-ups').send({
      order_id: 1,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('请求数据验证失败');
  });

  it('权限：canCreateFollowUp 返回 false 时403', async () => {
    permissionServiceMocks.canCreateFollowUp.mockResolvedValue(false);

    const response = await request(app).post('/api/follow-ups').send({
      order_id: 1,
      content: '尝试记录',
    });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('您没有权限对此订单创建跟进记录');
  });
});


