# Nexus AI — E2E Test Suite

End-to-end test infrastructure using **Playwright** with TypeScript.

## Setup

```bash
# Install dependencies (from project root)
pnpm install

# Install Playwright browsers
npx playwright install --with-deps

# Copy environment template
cp .env.example .env
# Edit .env with your local values
```

## Running Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run with UI mode (interactive)
pnpm test:e2e:ui

# Run headed (see browser)
pnpm test:e2e:headed

# Run with debug inspector
pnpm test:e2e:debug

# Run specific project (browser)
npx playwright test --project=chromium

# Run specific test file
npx playwright test tests/e2e/example.spec.ts

# View HTML report after run
npx playwright show-report playwright-report
```

## Architecture Overview

```
tests/
├── e2e/                          # Test files
│   └── example.spec.ts           # Sample tests demonstrating patterns
├── support/                      # Framework infrastructure
│   ├── fixtures/                 # Playwright fixtures (composable)
│   │   ├── index.ts              # Merged fixtures entry point
│   │   └── user-factory-fixture.ts
│   ├── factories/                # Data factories (pure functions)
│   │   └── user-factory.ts       # User data generation
│   ├── helpers/                  # Utility functions (framework-agnostic)
│   │   └── api-helpers.ts        # API request helpers
│   └── page-objects/             # Page object models (optional)
├── monorepo-setup.test.ts        # Existing vitest unit test
├── acceptance-criteria.test.ts   # Existing vitest unit test
└── README.md                     # This file
```

### Key Patterns

**Pure Function → Fixture → mergeTests**

1. Write helpers as pure functions in `support/helpers/` (unit-testable, framework-agnostic)
2. Wrap in Playwright fixtures in `support/fixtures/` (inject framework dependencies)
3. Compose with `mergeTests` in `support/fixtures/index.ts` (no inheritance)

**Data Factories**

- Located in `support/factories/`
- Generate unique, parallel-safe test data
- Use overrides to express test intent: `createUser({ role: 'admin' })`
- Auto-cleanup via fixture teardown

**Network-First Testing**

- Register interceptions **before** navigation or actions
- Store response promise → trigger action → await promise
- Never use `page.waitForTimeout()` — always wait for explicit signals

## Best Practices

### Selector Strategy

Always use `data-testid` attributes:

```typescript
await page.click('[data-testid="submit-button"]');
await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
```

Avoid brittle CSS selectors or XPath.

### Test Isolation

- Each test creates its own data via factories
- Fixtures handle cleanup automatically on teardown
- Tests can run in parallel without shared state

### Timeouts

| Scope       | Timeout |
|-------------|---------|
| Action      | 15s     |
| Navigation  | 30s     |
| Assertion   | 15s     |
| Test        | 60s     |

### Failure Artifacts

Captured **only on failure** to reduce storage:

- Screenshots: `test-results/`
- Videos: retained on failure
- Traces: retained on failure (view with `npx playwright show-trace`)
- HTML report: `playwright-report/`
- JUnit XML: `test-results/junit.xml`

## CI Integration

Tests produce JUnit XML (`test-results/junit.xml`) and HTML reports for CI artifact upload. Example GitHub Actions step:

```yaml
- name: Upload test results
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: test-results
    path: |
      test-results/
      playwright-report/
    retention-days: 30
```

## Adding New Tests

1. Create a `.spec.ts` file in `tests/e2e/`
2. Import from merged fixtures: `import { test, expect } from '../support/fixtures';`
3. Use factories for test data, fixtures for infrastructure
4. Follow network-first pattern for API interactions

## Adding New Fixtures

1. Create a pure helper in `support/helpers/`
2. Wrap in a fixture in `support/fixtures/`
3. Add to `mergeTests` in `support/fixtures/index.ts`

## Knowledge Base References

- **Fixture Architecture**: Pure function → fixture → mergeTests composition
- **Data Factories**: Faker-based factories with overrides and auto-cleanup
- **Network-First Safeguards**: Intercept before navigate, deterministic waits
- **Playwright Config**: Environment-based config, timeout standards, artifact output
- **Test Quality**: Deterministic, isolated, explicit, <300 lines, <1.5 min
