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
  // Create hospitals table
  pgm.createTable('hospitals', {
    id: 'id', // Auto-incrementing primary key (SERIAL PRIMARY KEY)
    name: {
      type: 'text',
      notNull: true,
    },
    phone: {
      type: 'text',
      notNull: true,
    },
    address: {
      type: 'text',
      notNull: true,
    },
    latitude: {
      type: 'numeric(10,7)',
      notNull: true,
    },
    longitude: {
      type: 'numeric(10,7)',
      notNull: true,
    },
    capabilities: {
      type: 'jsonb',
      default: "'[]'::jsonb",
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Add UNIQUE constraint on (name, latitude, longitude)
  pgm.addConstraint('hospitals', 'unique_hospital_location', {
    unique: ['name', 'latitude', 'longitude'],
  });

  // Create indexes on location coordinates and name
  pgm.createIndex('hospitals', ['latitude', 'longitude']);
  pgm.createIndex('hospitals', 'name');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  // Drop indexes first
  pgm.dropIndex('hospitals', 'name');
  pgm.dropIndex('hospitals', ['latitude', 'longitude']);

  // Drop constraint
  pgm.dropConstraint('hospitals', 'unique_hospital_location');

  // Drop the hospitals table
  pgm.dropTable('hospitals');
};
