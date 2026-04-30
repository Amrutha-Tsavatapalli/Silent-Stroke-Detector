# Database Migrations - Quick Reference

## Prerequisites

Set the DATABASE_URL environment variable:
```bash
export DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

Or add to `.env` file:
```
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

## Common Commands

### Verify Setup
```bash
npm run migrate:verify
```
Checks that the migration system is properly configured.

### Create New Migration
```bash
npm run migrate:create <migration-name>
```
**Example:**
```bash
npm run migrate:create create-users-table
```
Creates: `migrations/20240101120000000_create-users-table.js`

### Apply All Pending Migrations
```bash
npm run migrate:up
```
Applies all migrations that haven't been run yet.

### Rollback Last Migration
```bash
npm run migrate:down
```
Rolls back the most recently applied migration.

## Migration File Template

```javascript
/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export async function up(pgm) {
  // Apply changes
  pgm.createTable('table_name', {
    id: 'id',
    name: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') }
  });
}

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export async function down(pgm) {
  // Rollback changes
  pgm.dropTable('table_name');
}
```

## Common Operations

### Create Table
```javascript
pgm.createTable('users', {
  id: 'id',
  username: { type: 'text', notNull: true, unique: true },
  email: { type: 'text', notNull: true },
  created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') }
});
```

### Add Column
```javascript
pgm.addColumn('users', {
  phone: { type: 'text' }
});
```

### Create Index
```javascript
pgm.createIndex('users', 'email');
// or
pgm.createIndex('users', ['last_name', 'first_name']);
```

### Add Constraint
```javascript
pgm.addConstraint('users', 'unique_email', {
  unique: 'email'
});
```

### Alter Column
```javascript
pgm.alterColumn('users', 'email', {
  notNull: true
});
```

### Drop Table
```javascript
pgm.dropTable('users');
```

## Troubleshooting

### "DATABASE_URL environment variable is not set"
**Solution:** Set the DATABASE_URL environment variable or add it to your `.env` file.

### "relation already exists"
**Solution:** The migration may have been partially applied. Check the `pgmigrations` table to see what's been applied.

### "migration has already been run"
**Solution:** The migration is already in the `pgmigrations` table. If you need to re-run it, you'll need to manually remove it from the table or create a new migration.

## Best Practices

1. ✅ Always provide both `up` and `down` functions
2. ✅ Test migrations on a copy of production data
3. ✅ Keep migrations small and focused
4. ✅ Use descriptive migration names
5. ✅ Never modify existing migrations that have been applied
6. ✅ Use transactions (enabled by default)

## Documentation

For detailed documentation, see:
- [docs/MIGRATIONS.md](MIGRATIONS.md) - Complete migration guide
- [node-pg-migrate docs](https://github.com/salsita/node-pg-migrate) - Official documentation

## Requirements

This migration system satisfies:
- ✅ **Requirement 12.1**: Track applied migrations in schema_migrations table
- ✅ **Requirement 12.2**: Apply migrations in sequential order based on timestamp prefixes
