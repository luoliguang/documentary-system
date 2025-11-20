jest.mock('../../../src/config/database.js', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

const dbModule = jest.requireMock('../../../src/config/database.js') as {
  pool: { query: jest.Mock; connect: jest.Mock };
};

export const mockDbQuery = dbModule.pool.query;
export const mockDbConnect = dbModule.pool.connect;

export const createMockDbClient = () => ({
  query: jest.fn(),
  release: jest.fn(),
});



