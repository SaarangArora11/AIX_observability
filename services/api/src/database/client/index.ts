/**
 * API Service Database Client
 * Singleton wrapper around @refract/database
 */

import { createDatabaseSingletonWithClient, type Database } from '@refract/database';
import type postgres from 'postgres';

// Create singleton instance with both db and client
const { getDatabase: getDatabaseInstance, getClient: getClientInstance } =
  createDatabaseSingletonWithClient({
    connectionString: process.env.DATABASE_URL || '',
    max: 10,
    idleTimeout: 20,
    connectTimeout: 10,
  });

/**
 * Get the database instance for the API service
 * This is a singleton - the same instance will be returned on every call
 */
export function getDatabase(): Database {
  return getDatabaseInstance();
}

/**
 * Get the raw postgres client for the API service
 * Useful for complex queries that Drizzle doesn't handle well
 */
export function getClient(): postgres.Sql {
  return getClientInstance();
}

// Re-export everything from @refract/database for convenience
export * from '@refract/database';
