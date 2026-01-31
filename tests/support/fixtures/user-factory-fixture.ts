import { test as base } from '@playwright/test';
import { createUser, User } from '../factories/user-factory';

type UserFactoryFixture = {
  userFactory: {
    create: (overrides?: Partial<User>) => Promise<User>;
    cleanup: () => Promise<void>;
  };
};

export const test = base.extend<UserFactoryFixture>({
  userFactory: async ({ request }, use) => {
    const createdUserIds: string[] = [];

    const create = async (overrides: Partial<User> = {}): Promise<User> => {
      const user = createUser(overrides);

      const response = await request.post(
        `${process.env.API_URL || 'http://localhost:3001/api'}/users`,
        { data: user },
      );

      if (response.ok()) {
        const created = await response.json();
        createdUserIds.push(created.id);
        return { ...user, ...created };
      }

      // If API is not available, return local factory data
      return user;
    };

    const cleanup = async () => {
      for (const userId of createdUserIds) {
        await request
          .delete(
            `${process.env.API_URL || 'http://localhost:3001/api'}/users/${userId}`,
          )
          .catch(() => {
            // Cleanup is best-effort
          });
      }
      createdUserIds.length = 0;
    };

    await use({ create, cleanup });

    // Auto-cleanup on fixture teardown
    await cleanup();
  },
});
