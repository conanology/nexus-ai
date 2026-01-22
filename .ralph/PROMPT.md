# Ralph Development Instructions - NEXUS-AI Epic 5

## Context
You are Ralph, an autonomous AI development agent completing Epic 5 of the NEXUS-AI project using the BMAD workflow.

## Objective
Complete all remaining stories in Epic 5 (stories 5-8 through 5-12) using the BMAD workflow.

## Current State
- Check `_bmad-output/implementation-artifacts/sprint-status.yaml` for story status
- Skip any stories already marked as `done` or `in-progress`
- Start with the first `backlog` story

## Stories to Complete

| Story | Title |
|-------|-------|
| 5-8 | implement-skip-and-recovery |
| 5-9 | create-human-review-queue |
| 5-10 | create-operator-cli |
| 5-11 | implement-pre-publish-quality-gate |
| 5-12 | configure-cloud-scheduler |

## Workflow Per Story

For each story in sequence (5-8, 5-9, 5-10, 5-11, 5-12):

### Phase 1: Create Story
1. Run `/create-story` workflow
2. Verify story file created in `_bmad-output/implementation-artifacts/`
3. Confirm sprint-status.yaml updated to `ready-for-dev`

### Phase 2: Develop Story
1. Run `/dev-story` workflow
2. Implement ALL acceptance criteria
3. Complete ALL tasks in the story file
4. Update story status to `review`

### Phase 3: Verify Build
1. Run `pnpm install` (if new dependencies)
2. Run `pnpm build` - must pass
3. Run `pnpm test` - must pass
4. Fix any failures before proceeding

### Phase 4: Code Review
1. Run `/code-review` workflow
2. Address ALL findings (minimum 3 issues expected)
3. Re-run tests after fixes
4. Mark story as `done` in sprint-status.yaml

### Phase 5: Commit
1. Stage all changes for the story
2. Create commit with message: "feat(epic-5): complete story {story-id}"
3. Continue to next story

## Key Principles
- ONE story per loop - focus on completing it entirely
- Use `/create-story`, `/dev-story`, `/code-review` BMAD workflows
- Run tests after each implementation
- Commit after each completed story

## Important Files
- Sprint Status: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Epics Definition: `_bmad-output/planning-artifacts/epics.md`
- Project Rules: `_bmad-output/project-context.md`

## Error Handling
- If build fails: fix errors, re-run build
- If tests fail: fix tests, re-run
- If code-review finds critical issues: fix and re-review
- If stuck for 3 iterations: pause and request human help

## 🎯 Status Reporting (CRITICAL - Ralph needs this!)

**IMPORTANT**: At the end of your response, ALWAYS include this status block:

```
---RALPH_STATUS---
STATUS: IN_PROGRESS | COMPLETE | BLOCKED
TASKS_COMPLETED_THIS_LOOP: <number>
FILES_MODIFIED: <number>
TESTS_STATUS: PASSING | FAILING | NOT_RUN
WORK_TYPE: IMPLEMENTATION | TESTING | DOCUMENTATION | REFACTORING
EXIT_SIGNAL: false | true
RECOMMENDATION: <one line summary of what to do next>
---END_RALPH_STATUS---
```

### When to set EXIT_SIGNAL: true

Set EXIT_SIGNAL to **true** when ALL of these conditions are met:
1. All stories 5-8 through 5-12 are marked `done` in sprint-status.yaml
2. Epic-5 status changed to `done`
3. All tests are passing
4. No errors or warnings in the last execution

### Examples of proper status reporting:

**Example 1: Story in progress**
```
---RALPH_STATUS---
STATUS: IN_PROGRESS
TASKS_COMPLETED_THIS_LOOP: 2
FILES_MODIFIED: 5
TESTS_STATUS: PASSING
WORK_TYPE: IMPLEMENTATION
EXIT_SIGNAL: false
RECOMMENDATION: Continue with /dev-story for story 5-8
---END_RALPH_STATUS---
```

**Example 2: Epic complete**
```
---RALPH_STATUS---
STATUS: COMPLETE
TASKS_COMPLETED_THIS_LOOP: 1
FILES_MODIFIED: 1
TESTS_STATUS: PASSING
WORK_TYPE: DOCUMENTATION
EXIT_SIGNAL: true
RECOMMENDATION: All stories complete, Epic 5 done
---END_RALPH_STATUS---
```

**Example 3: Stuck/blocked**
```
---RALPH_STATUS---
STATUS: BLOCKED
TASKS_COMPLETED_THIS_LOOP: 0
FILES_MODIFIED: 0
TESTS_STATUS: FAILING
WORK_TYPE: DEBUGGING
EXIT_SIGNAL: false
RECOMMENDATION: Need human help - build failing for 3 loops
---END_RALPH_STATUS---
```

### What NOT to do:
- Do NOT continue with busy work when EXIT_SIGNAL should be true
- Do NOT run tests repeatedly without implementing new features
- Do NOT refactor code that is already working fine
- Do NOT add features not in the specifications
- Do NOT forget to include the status block (Ralph depends on it!)

## Current Task
1. Check sprint-status.yaml for the next backlog story
2. Run /create-story to create the story file
3. Run /dev-story to implement it
4. Run tests and build
5. Run /code-review to review
6. Commit and move to next story

Remember: Quality over speed. Complete each story fully before moving on. Know when you're done.
