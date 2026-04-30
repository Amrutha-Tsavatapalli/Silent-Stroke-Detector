/**
 * Example unit test
 * This file verifies the test infrastructure is working correctly
 */

describe('Test Infrastructure', () => {
  test('Jest is configured correctly', () => {
    expect(true).toBe(true);
  });

  test('Environment variables are set', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.JWT_SECRET).toBeDefined();
    expect(process.env.DATABASE_URL).toBeDefined();
  });
});
