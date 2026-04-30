/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  // Create audit_trail table
  pgm.createTable('audit_trail', {
    id: 'id', // Auto-incrementing primary key (SERIAL PRIMARY KEY)
    user_id: {
      type: 'integer',
      references: 'users(id)',
    },
    operation: {
      type: 'text',
      notNull: true,
      check: "operation IN ('CREATE', 'UPDATE', 'DELETE')",
    },
    table_name: {
      type: 'text',
      notNull: true,
    },
    record_id: {
      type: 'integer',
      notNull: true,
    },
    old_values: {
      type: 'jsonb',
    },
    new_values: {
      type: 'jsonb',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Create indexes on user_id, created_at, and (table_name, record_id)
  pgm.createIndex('audit_trail', 'user_id');
  pgm.createIndex('audit_trail', 'created_at');
  pgm.createIndex('audit_trail', ['table_name', 'record_id']);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  // Drop indexes first
  pgm.dropIndex('audit_trail', ['table_name', 'record_id']);
  pgm.dropIndex('audit_trail', 'created_at');
  pgm.dropIndex('audit_trail', 'user_id');

  // Drop the audit_trail table
  pgm.dropTable('audit_trail');
};
