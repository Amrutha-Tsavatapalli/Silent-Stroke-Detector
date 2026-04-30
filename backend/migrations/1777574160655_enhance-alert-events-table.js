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
  // Add notification_status column with default 'pending'
  pgm.addColumns('alert_events', {
    notification_status: {
      type: 'text',
      default: "'pending'",
    },
    twilio_message_sid: {
      type: 'text',
    },
    error_message: {
      type: 'text',
    },
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  // Remove the added columns
  pgm.dropColumns('alert_events', [
    'notification_status',
    'twilio_message_sid',
    'error_message',
  ]);
};
