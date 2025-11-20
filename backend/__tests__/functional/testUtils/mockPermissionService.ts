const permissionServiceMocks = {
  canCreateOrder: jest.fn(),
  canUpdateOrder: jest.fn(),
  canUpdateOrderFieldByRole: jest.fn(),
  canCreateFollowUp: jest.fn(),
  canAccessFollowUp: jest.fn(),
  canCreateReminder: jest.fn(),
  canRespondReminder: jest.fn(),
  getProductionManagerOrderTypes: jest.fn(),
};

jest.mock('../../../src/services/permissionService.js', () => ({
  __esModule: true,
  canCreateOrder: (...args: any[]) => permissionServiceMocks.canCreateOrder(...args),
  canUpdateOrder: (...args: any[]) => permissionServiceMocks.canUpdateOrder(...args),
  canUpdateOrderFieldByRole: (...args: any[]) =>
    permissionServiceMocks.canUpdateOrderFieldByRole(...args),
  canCreateFollowUp: (...args: any[]) => permissionServiceMocks.canCreateFollowUp(...args),
  canAccessFollowUp: (...args: any[]) => permissionServiceMocks.canAccessFollowUp(...args),
  canCreateReminder: (...args: any[]) => permissionServiceMocks.canCreateReminder(...args),
  canRespondReminder: (...args: any[]) => permissionServiceMocks.canRespondReminder(...args),
  getProductionManagerOrderTypes: (...args: any[]) =>
    permissionServiceMocks.getProductionManagerOrderTypes(...args),
}));

export default permissionServiceMocks;

