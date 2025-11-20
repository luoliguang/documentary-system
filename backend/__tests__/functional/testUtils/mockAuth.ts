const authState: { currentUser: any } = {
  currentUser: { userId: 1, role: 'admin', username: 'Admin' },
};

jest.mock('../../../src/middleware/auth.js', () => {
  const attachUser = (req: any) => {
    if (authState.currentUser) {
      req.user = authState.currentUser;
    }
  };

  return {
    __esModule: true,
    authenticateToken: (req: any, res: any, next: any) => {
      if (!authState.currentUser) {
        return res.status(401).json({ error: '未提供认证令牌' });
      }
      attachUser(req);
      next();
    },
    requireAdmin: (req: any, res: any, next: any) => {
      if (!authState.currentUser) {
        return res.status(401).json({ error: '未认证' });
      }
      attachUser(req);
      if (authState.currentUser.role !== 'admin') {
        return res.status(403).json({ error: '需要管理员权限' });
      }
      next();
    },
    requireCustomer: (req: any, res: any, next: any) => {
      if (!authState.currentUser) {
        return res.status(401).json({ error: '未认证' });
      }
      attachUser(req);
      if (authState.currentUser.role !== 'customer') {
        return res.status(403).json({ error: '需要客户权限' });
      }
      next();
    },
    setMockUser: (user: any) => {
      authState.currentUser = user;
    },
    clearMockUser: () => {
      authState.currentUser = null;
    },
  };
});

const authModule = jest.requireMock('../../../src/middleware/auth.js') as {
  setMockUser: (user: any) => void;
  clearMockUser: () => void;
};

export const setMockUser = authModule.setMockUser;
export const clearMockUser = authModule.clearMockUser;


