const notificationServiceMocks = {
  createNotification: jest.fn(),
  createNotificationsForUsers: jest.fn(),
  getAllAdminUserIds: jest.fn(),
  markOrderNotificationsAsRead: jest.fn(),
};

jest.mock('../../../src/services/notificationService.js', () => ({
  createNotification: (...args: any[]) =>
    notificationServiceMocks.createNotification(...args),
  createNotificationsForUsers: (...args: any[]) =>
    notificationServiceMocks.createNotificationsForUsers(...args),
  getAllAdminUserIds: (...args: any[]) =>
    notificationServiceMocks.getAllAdminUserIds(...args),
  markOrderNotificationsAsRead: (...args: any[]) =>
    notificationServiceMocks.markOrderNotificationsAsRead(...args),
}));

export default notificationServiceMocks;


