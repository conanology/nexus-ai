import { test as base, mergeTests } from '@playwright/test';
import { test as userFactoryFixture } from './user-factory-fixture';

/**
 * Merged test fixtures for Nexus AI E2E tests.
 *
 * Pattern: pure function → fixture → mergeTests composition.
 * Add new fixtures here as the test suite grows.
 */
export const test = mergeTests(base, userFactoryFixture);

export { expect } from '@playwright/test';
