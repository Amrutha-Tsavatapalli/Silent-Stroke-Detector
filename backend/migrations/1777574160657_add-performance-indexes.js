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
  // Add indexes on screenings table for performance
  pgm.createIndex('screenings', 'patient_name');
  pgm.createIndex('screenings', 'location');
  pgm.createIndex('screenings', 'created_at', { method: 'btree', order: 'DESC' });
  pgm.createIndex('screenings', 'risk_score');
  pgm.createIndex('screenings', 'should_alert');
  pgm.createIndex('screenings', 'priority');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  // Drop all the indexes
  pgm.dropIndex('screenings', 'priority');
  pgm.dropIndex('screenings', 'should_alert');
  pgm.dropIndex('screenings', 'risk_score');
  pgm.dropIndex('screenings', 'created_at');
  pgm.dropIndex('screenings', 'location');
  pgm.dropIndex('screenings', 'patient_name');
};
