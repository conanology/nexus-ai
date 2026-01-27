# Agent Build Instructions - NEXUS-AI Project

## Project Setup
```bash
# Install dependencies using pnpm (monorepo)
pnpm install
```

## Running Tests
```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @nexus-ai/core test
pnpm --filter @nexus-ai/orchestrator test
```

## Build Commands
```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @nexus-ai/core build
```

## Type Checking
```bash
# Run TypeScript type checking
pnpm typecheck
```

## Linting
```bash
# Run linting
pnpm lint
```

## Git Commit Format (Phase 4)

### Commit Message Template
```
feat({package}): {story-title} (Story {story-key})

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

### Commit Examples
```bash
# Feature implementation
git commit -m "feat(timestamp-extraction): create timestamp extraction package (Story 6-5)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

# Bug fix from code review
git commit -m "fix(tts): correct audio chunking boundary detection (Story 6-4)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

# Refactoring
git commit -m "refactor(visual-gen): optimize motion hook performance (Story 6-14)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

### Package Scope Reference
Use the package name from the story for the scope:
- `timestamp-extraction` - Stories 6-5 through 6-12
- `visual-generation` - Stories 6-13 through 6-18
- `audio-mixer` - Stories 6-19 through 6-26
- `broll-engine` - Stories 6-27 through 6-31
- `orchestrator` - Stories 6-32 through 6-34

## Quality Gates Before Commit

Before creating a commit (Phase 4), ALL of these must pass:

```bash
# 1. Build must succeed
pnpm build

# 2. All tests must pass
pnpm test

# 3. Type checking must pass (optional but recommended)
pnpm typecheck
```

### Quality Gate Checklist
- [ ] `pnpm build` exits with code 0
- [ ] `pnpm test` exits with code 0
- [ ] Story status is `done` in sprint-status.yaml
- [ ] Code review has passed (status changed from `review` to `done`)

## Key Learnings
- Update this section when you learn new build optimizations
- Document any gotchas or special setup requirements
- Keep track of the fastest test/build cycle

## Feature Development Quality Standards

**CRITICAL**: All new features MUST meet the following mandatory requirements before being considered complete.

### Testing Requirements

- **Minimum Coverage**: 85% code coverage ratio required for all new code
- **Test Pass Rate**: 100% - all tests must pass, no exceptions
- **Test Types Required**:
  - Unit tests for all business logic and services
  - Integration tests for API endpoints or main functionality
  - End-to-end tests for critical user workflows
- **Coverage Validation**: Run coverage reports before marking features complete:
  ```bash
  # Examples by language/framework
  npm run test:coverage
  pytest --cov=src tests/ --cov-report=term-missing
  cargo tarpaulin --out Html
  ```
- **Test Quality**: Tests must validate behavior, not just achieve coverage metrics
- **Test Documentation**: Complex test scenarios must include comments explaining the test strategy

### Git Workflow Requirements

Before moving to the next feature, ALL changes must be:

1. **Committed with Clear Messages**:
   ```bash
   git add .
   git commit -m "feat(module): descriptive message following conventional commits"
   ```
   - Use conventional commit format: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, etc.
   - Include scope when applicable: `feat(api):`, `fix(ui):`, `test(auth):`
   - Write descriptive messages that explain WHAT changed and WHY

2. **Pushed to Remote Repository**:
   ```bash
   git push origin <branch-name>
   ```
   - Never leave completed features uncommitted
   - Push regularly to maintain backup and enable collaboration
   - Ensure CI/CD pipelines pass before considering feature complete

3. **Branch Hygiene**:
   - Work on feature branches, never directly on `main`
   - Branch naming convention: `feature/<feature-name>`, `fix/<issue-name>`, `docs/<doc-update>`
   - Create pull requests for all significant changes

4. **Ralph Integration**:
   - Update .ralph/@fix_plan.md with new tasks before starting work
   - Mark items complete in .ralph/@fix_plan.md upon completion
   - Update .ralph/PROMPT.md if development patterns change
   - Test features work within Ralph's autonomous loop

### Documentation Requirements

**ALL implementation documentation MUST remain synchronized with the codebase**:

1. **Code Documentation**:
   - Language-appropriate documentation (JSDoc, docstrings, etc.)
   - Update inline comments when implementation changes
   - Remove outdated comments immediately

2. **Implementation Documentation**:
   - Update relevant sections in this AGENT.md file
   - Keep build and test commands current
   - Update configuration examples when defaults change
   - Document breaking changes prominently

3. **README Updates**:
   - Keep feature lists current
   - Update setup instructions when dependencies change
   - Maintain accurate command examples
   - Update version compatibility information

4. **AGENT.md Maintenance**:
   - Add new build patterns to relevant sections
   - Update "Key Learnings" with new insights
   - Keep command examples accurate and tested
   - Document new testing patterns or quality gates

### Feature Completion Checklist

Before marking ANY feature as complete, verify:

- [ ] All tests pass with appropriate framework command
- [ ] Code coverage meets 85% minimum threshold
- [ ] Coverage report reviewed for meaningful test quality
- [ ] Code formatted according to project standards
- [ ] Type checking passes (if applicable)
- [ ] All changes committed with conventional commit messages
- [ ] All commits pushed to remote repository
- [ ] .ralph/@fix_plan.md task marked as complete
- [ ] Implementation documentation updated
- [ ] Inline code comments updated or added
- [ ] .ralph/@AGENT.md updated (if new patterns introduced)
- [ ] Breaking changes documented
- [ ] Features tested within Ralph loop (if applicable)
- [ ] CI/CD pipeline passes

### Rationale

These standards ensure:
- **Quality**: High test coverage and pass rates prevent regressions
- **Traceability**: Git commits and .ralph/@fix_plan.md provide clear history of changes
- **Maintainability**: Current documentation reduces onboarding time and prevents knowledge loss
- **Collaboration**: Pushed changes enable team visibility and code review
- **Reliability**: Consistent quality gates maintain production stability
- **Automation**: Ralph integration ensures continuous development practices

**Enforcement**: AI agents should automatically apply these standards to all feature development tasks without requiring explicit instruction for each task.

## Ralph Status Block Format

At the end of every response, include:

```
---RALPH_STATUS---
STATUS: IN_PROGRESS | COMPLETE | BLOCKED
CURRENT_PHASE: create-story | dev-story | code-review | commit
CURRENT_STORY: {story-key}
CODE_REVIEW_RESULT: passed | issues-found | N/A
CODE_REVIEW_ITERATION: {n}/5
TASKS_COMPLETED_THIS_LOOP: <number>
FILES_MODIFIED: <number>
TESTS_STATUS: PASSING | FAILING | NOT_RUN
BUILD_STATUS: PASSING | FAILING | NOT_RUN
WORK_TYPE: IMPLEMENTATION | TESTING | REVIEW | COMMIT
EXIT_SIGNAL: false | true
RECOMMENDATION: <one line summary of what to do next>
---END_RALPH_STATUS---
```
