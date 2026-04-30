# Test Suite

This directory contains the test suite for the Silent Stroke Detector backend.

## Structure

- `unit/` - Unit tests for individual services, repositories, and utilities
- `integration/` - Integration tests for API endpoints and database interactions
- `setup.js` - Global test setup and configuration

## Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run tests with coverage report
npm run test:coverage
```

## Test Database

Integration tests require a separate test database. Set the `TEST_DATABASE_URL` environment variable to point to your test database:

```bash
export TEST_DATABASE_URL=postgresql://postgres:password@localhost:5432/silent_stroke_detector_test
```

The test database will be automatically reset before each test run.

## Writing Tests

### Unit Tests

Unit tests should test individual functions and classes in isolation, using mocks for dependencies.

Example:
```javascript
import { AuthService } from '../../src/services/authService.js';

describe('AuthService', () => {
  test('should hash password correctly', async () => {
    const service = new AuthService();
    const hashed = await service.hashPassword('password123');
    expect(hashed).not.toBe('password123');
  });
});
```

### Integration Tests

Integration tests should test complete API flows, including database interactions.

Example:
```javascript
import request from 'supertest';
import app from '../../src/server.js';

describe('POST /api/auth/login', () => {
  test('should return token for valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password' });
    
    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
  });
});
```

## Coverage Requirements

The test suite must maintain minimum 80% code coverage for:
- Branches
- Functions
- Lines
- Statements

Coverage reports are generated in the `coverage/` directory.
