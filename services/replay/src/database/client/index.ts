/**
 * Replay Service Database Client
 * Singleton wrapper around @refract/database
 */

import { createDatabaseSingleton, type Database } from '@refract/database';

// Create singleton instance
const getDatabaseInstance = createDatabaseSingleton({
  connectionString: process.env.DATABASE_URL || '',
  max: 10,
  idleTimeout: 20,
  connectTimeout: 10,
});

/**
 * Get the database instance for the Replay service
 * This is a singleton - the same instance will be returned on every call
 */
export function getDatabase(): Database {
  return getDatabaseInstance();
}

// Re-export everything from @refract/database for convenience
export * from '@refract/database';
