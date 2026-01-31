/**
 * User data factory.
 *
 * Generates unique, parallel-safe test data using randomized values.
 * Override any field to express test intent explicitly.
 *
 * Uses inline random generation instead of faker to avoid an extra
 * dependency during initial setup. Replace with @faker-js/faker
 * when richer data generation is needed.
 */

export type User = {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'moderator';
  createdAt: string;
  isActive: boolean;
};

let counter = 0;

function uniqueId(): string {
  counter += 1;
  return `${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createUser(overrides: Partial<User> = {}): User {
  const id = uniqueId();
  return {
    id,
    email: `test-${id}@example.com`,
    name: `Test User ${id.slice(-6)}`,
    role: 'user',
    createdAt: new Date().toISOString(),
    isActive: true,
    ...overrides,
  };
}

export function createAdminUser(overrides: Partial<User> = {}): User {
  return createUser({ role: 'admin', ...overrides });
}
