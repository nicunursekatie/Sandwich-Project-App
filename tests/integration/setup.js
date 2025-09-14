/**
 * Test Setup for Integration Tests
 * Sets up test database and configurations
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

// Extend Jest timeout for integration tests
jest.setTimeout(30000);

// Setup and teardown hooks
beforeAll(async () => {
  console.log('🧪 Starting integration tests...');
  // Wait for server to be ready
  await new Promise((resolve) => setTimeout(resolve, 2000));
});

afterAll(async () => {
  console.log('✅ Integration tests completed');
  // Clean up if needed
});

// Global test helpers
global.expect.extend({
  toBeValidId(received) {
    const pass = typeof received === 'number' && received > 0;
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid ID`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be a valid ID (positive number)`,
        pass: false,
      };
    }
  },

  toBeISODate(received) {
    const pass = typeof received === 'string' && !isNaN(Date.parse(received));
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid ISO date`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid ISO date string`,
        pass: false,
      };
    }
  },
});
