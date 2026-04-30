# Silent Stroke Detector Backend

Production-ready Node.js/Express backend for the Silent Stroke Detector medical screening platform.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **Real-time Notifications**: SMS and voice call alerts via Twilio
- **Analytics Engine**: Aggregate screening statistics and trend analysis
- **Advanced Search**: Multi-criteria filtering for screening data
- **Hospital Management**: CRUD operations for medical facility records
- **Audit Logging**: Comprehensive audit trail for compliance
- **API Documentation**: OpenAPI 3.0 specification with Swagger UI
- **Database Migrations**: Versioned schema management with node-pg-migrate
- **Comprehensive Testing**: Integration and unit tests with Jest

## Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment configuration:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
   - Set `DATABASE_URL` to your PostgreSQL connection string
   - Set `JWT_SECRET` to a secure random string (minimum 32 characters)
   - Configure Twilio credentials for notifications
   - Adjust other settings as needed

4. Initialize the database:
```bash
npm run db:init
```

5. Run database migrations:
```bash
npm run migrate:up
```

## Development

Start the development server with hot reload:
```bash
npm run dev
```

The server will start on `http://localhost:8080` (or the port specified in `.env`).

## Testing

Run all tests:
```bash
npm test
```

Run specific test suites:
```bash
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:coverage      # Generate coverage report
```

## Database Migrations

Verify migration setup:
```bash
npm run migrate:verify
```

Create a new migration:
```bash
npm run migrate:create migration-name
```

Apply migrations:
```bash
npm run migrate:up
```

Rollback last migration:
```bash
npm run migrate:down
```

For detailed migration documentation, see [docs/MIGRATIONS.md](docs/MIGRATIONS.md).

## Code Quality

Run linter:
```bash
npm run lint
```

Format code:
```bash
npm run format
```

## Project Structure

```
backend/
├── src/
│   ├── middleware/       # Express middleware (auth, validation, rate limiting)
│   ├── services/         # Business logic layer
│   ├── repositories/     # Data access layer
│   ├── routes/           # API route handlers
│   ├── docs/             # API documentation (OpenAPI specs)
│   ├── scripts/          # Utility scripts
│   ├── config.js         # Configuration management
│   ├── db.js             # Database connection
│   └── server.js         # Express app entry point
├── migrations/           # Database migration files
├── tests/
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── setup.js          # Test configuration
├── .env.example          # Environment variable template
├── jest.config.js        # Jest configuration
├── .eslintrc.json        # ESLint configuration
└── .prettierrc.json      # Prettier configuration
```

## API Documentation

Once the server is running, access the interactive API documentation at:
- Swagger UI: `http://localhost:8080/api/docs`
- OpenAPI JSON: `http://localhost:8080/api/docs/openapi.json`

## Environment Variables

See `.env.example` for all available configuration options:

### Required Variables
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT signing (minimum 32 characters)
- `TWILIO_ACCOUNT_SID`: Twilio account identifier
- `TWILIO_AUTH_TOKEN`: Twilio authentication token
- `TWILIO_PHONE_NUMBER`: Twilio phone number for outbound calls/SMS

### Optional Variables
- `PORT`: Server port (default: 8080)
- `NODE_ENV`: Environment (development, staging, production)
- `ALERT_THRESHOLD`: Risk score threshold for alerts (default: 0.7)
- `CORS_ORIGINS`: Comma-separated allowed origins (default: *)
- `RATE_LIMIT_WINDOW_MS`: Rate limit window in milliseconds (default: 900000)
- `RATE_LIMIT_MAX`: Max requests per window (default: 100)
- `LOG_LEVEL`: Logging level (debug, info, warn, error)

## Production Deployment

1. Set `NODE_ENV=production`
2. Use a secure `JWT_SECRET` (generate with `openssl rand -base64 32`)
3. Configure production database with SSL
4. Set up proper CORS origins
5. Enable HTTPS (use reverse proxy like nginx)
6. Configure monitoring and alerting
7. Set up automated backups for the database

## Health Checks

- Liveness: `GET /health/live` - Returns 200 if server is running
- Readiness: `GET /health/ready` - Returns 200 if database is connected
- Metrics: `GET /health/metrics` - Returns performance metrics

## Security

- Passwords hashed with bcrypt (12 rounds)
- JWT tokens with 24-hour expiration
- Rate limiting (100 requests per 15 minutes)
- SQL injection prevention via parameterized queries
- Security headers (CSP, X-Frame-Options, etc.)
- Input validation with Joi schemas

## License

Private - All rights reserved
