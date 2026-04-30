# Database Migrations Guide

## Overview

This project uses [node-pg-migrate](https://github.com/salsita/node-pg-migrate) for database schema versioning and migrations. The migration system tracks applied migrations in a `pgmigrations` table and ensures migrations are applied in sequential order.

## Configuration

### Migration Configuration File

The migration system is configured via `.node-pg-migraterc.json`:

```json
{
  "database-url-var": "DATABASE_URL",
  "migrations-dir": "migrations",
  "dir": "migrations",
  "migration-file-language": "js",
  "migration-filename-format": "utc",
  "check-order": true,
  "create-schema": true,
  "create-migrations-schema": false,
  "single-transaction": true,
  "decamelize": false,
  "ignore-pattern": "\\..*"
}
```

**Key Configuration Options:**

- `database-url-var`: Environment variable name for database connection (DATABASE_URL)
- `migrations-dir`: Directory containing migration files (migrations/)
- `migration-file-language`: Language for migration files (js)
- `migration-filename-format`: Filename format using UTC timestamps
- `check-order`: Ensures migrations are applied in order
- `single-transaction`: Wraps all pending migrations in a single transaction
- `create-schema`: Creates the schema if it doesn't exist

### Environment Variables

The migration system requires the `DATABASE_URL` environment variable:

```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/silent_stroke_detector
```

Set this in your `.env` file for local development or as an environment variable in production.

## Migration Tracking

node-pg-migrate automatically creates and manages a `pgmigrations` table to track which migrations have been applied:

```sql
CREATE TABLE pgmigrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  run_on TIMESTAMP NOT NULL
);
```

This table is created automatically on the first migration run and satisfies **Requirement 12.1**: "THE Migration_System SHALL track applied migrations in a schema_migrations table".

## NPM Scripts

The following npm scripts are available for managing migrations:

### Apply Migrations

```bash
npm run migrate:up
```

Applies all pending migrations in sequential order (satisfies **Requirement 12.2**).

### Rollback Last Migration

```bash
npm run migrate:down
```

Rolls back the most recently applied migration.

### Create New Migration

```bash
npm run migrate:create <migration-name>
```

Creates a new migration file with a UTC timestamp prefix.

**Example:**
```bash
npm run migrate:create create-users-table
```

This creates a file like: `migrations/20240101120000000_create-users-table.js`

## Migration File Structure

Each migration file exports `up` and `down` functions:

```javascript
/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export async function up(pgm) {
  // Migration logic to apply changes
  pgm.createTable('users', {
    id: 'id',
    username: { type: 'text', notNull: true, unique: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') }
  });
}

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export async function down(pgm) {
  // Rollback logic to undo changes
  pgm.dropTable('users');
}
```

## Migration Workflow

### 1. Create a New Migration

```bash
npm run migrate:create add-notification-columns
```

### 2. Edit the Migration File

Open the generated file in `migrations/` and implement the `up` and `down` functions.

### 3. Apply the Migration

```bash
npm run migrate:up
```

### 4. Verify the Changes

Connect to your database and verify the schema changes were applied correctly.

### 5. Rollback if Needed

If something goes wrong:

```bash
npm run migrate:down
```

## Best Practices

### 1. Idempotency

Migrations should be safe to run multiple times. Use `IF NOT EXISTS` clauses where appropriate:

```javascript
pgm.createTable('users', {
  // ...
}, { ifNotExists: true });
```

### 2. Backward Compatibility

Avoid breaking changes to existing data. When renaming or removing columns:

1. Add new column
2. Migrate data
3. Remove old column (in a separate migration)

### 3. Data Migrations

When schema changes affect existing data, include data transformation in the migration:

```javascript
export async function up(pgm) {
  pgm.addColumn('users', {
    full_name: { type: 'text' }
  });
  
  // Migrate existing data
  pgm.sql(`
    UPDATE users 
    SET full_name = first_name || ' ' || last_name
  `);
}
```

### 4. Testing Migrations

Always test migrations on a copy of production data before deploying:

1. Create a database backup
2. Restore to a test database
3. Run migrations
4. Verify data integrity
5. Test rollback

### 5. Always Provide Rollback

Every migration should have a corresponding `down` function for rollback capability.

## Transaction Handling

By default, all pending migrations are wrapped in a single transaction (`single-transaction: true`). This means:

- If any migration fails, all changes are rolled back
- Database remains in a consistent state
- No partial migrations are applied

To disable this for a specific migration (e.g., for operations that can't run in a transaction):

```javascript
export async function up(pgm) {
  pgm.noTransaction();
  // Migration logic
}
```

## Troubleshooting

### Migration Fails with "relation already exists"

The migration may have been partially applied. Check the `pgmigrations` table to see which migrations have been recorded as applied.

### Can't Connect to Database

Verify your `DATABASE_URL` environment variable is set correctly:

```bash
echo $DATABASE_URL  # Unix/Mac
echo %DATABASE_URL%  # Windows CMD
$env:DATABASE_URL   # Windows PowerShell
```

### Migration Order Issues

If migrations are applied out of order, node-pg-migrate will detect this (due to `check-order: true`) and prevent execution. Ensure migration filenames have correct timestamps.

## Requirements Satisfied

This migration system setup satisfies the following requirements:

- ✅ **Requirement 12.1**: THE Migration_System SHALL track applied migrations in a schema_migrations table
  - Implemented via node-pg-migrate's automatic `pgmigrations` table

- ✅ **Requirement 12.2**: THE Migration_System SHALL apply migrations in sequential order based on timestamp prefixes
  - Implemented via `migration-filename-format: "utc"` and `check-order: true`

## Next Steps

The migration system is now configured and ready to use. The next tasks will create specific migrations for:

1. Users table (Task 4)
2. Hospitals table (Task 5)
3. Alert events enhancements (Task 6)
4. Audit trail table (Task 7)
5. Performance indexes (Task 8)

## References

- [node-pg-migrate Documentation](https://github.com/salsita/node-pg-migrate)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
