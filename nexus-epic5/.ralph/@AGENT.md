# Agent Build Instructions

## Project Setup
```bash
# Install dependencies
pnpm install
```

## Running Tests
```bash
# Run all tests
pnpm test
```

## Build Commands
```bash
# Build the project
pnpm build
```

## BMAD Workflow Commands
```bash
# Create a new story from epic definition
/create-story

# Start development on a story
/dev-story

# Run code review
/code-review
```

## Key Files
- Sprint Status: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Epics Definition: `_bmad-output/planning-artifacts/epics.md`
- Project Rules: `_bmad-output/project-context.md`
- Story Files: `_bmad-output/implementation-artifacts/story-{id}.md`

## Key Learnings
- Update this section when you learn new build optimizations
- Document any gotchas or special setup requirements
- Keep track of the fastest test/build cycle

## Feature Development Quality Standards

**CRITICAL**: All new features MUST meet the following mandatory requirements before being considered complete.

### Testing Requirements

- **Minimum Coverage**: 85% code coverage ratio required for all new code
- **Test Pass Rate**: 100% - all tests must pass, no exceptions
- **Coverage Validation**: Run coverage reports before marking features complete:
  ```bash
  pnpm test:coverage
  ```
- **Test Quality**: Tests must validate behavior, not just achieve coverage metrics

### Git Workflow Requirements

Before moving to the next story, ALL changes must be:

1. **Committed with Clear Messages**:
   ```bash
   git add .
   git commit -m "feat(epic-5): complete story {story-id}"
   ```
   - Use conventional commit format
   - Include scope: `feat(epic-5):`

2. **Branch Hygiene**:
   - Complete one story fully before starting the next
   - Commit after each story completion

### Ralph Integration

- Update .ralph/@fix_plan.md with task progress
- Mark items complete as you finish them
- Include RALPH_STATUS block at end of each response

### Feature Completion Checklist

Before marking ANY story as complete, verify:

- [ ] All acceptance criteria implemented
- [ ] All tests pass with `pnpm test`
- [ ] Build succeeds with `pnpm build`
- [ ] Code review completed and findings addressed
- [ ] Story status updated to `done` in sprint-status.yaml
- [ ] Git commit created with proper message format
- [ ] .ralph/@fix_plan.md updated
