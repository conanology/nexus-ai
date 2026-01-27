# Ralph Fix Plan - NEXUS-AI BMAD Workflow

## Current Sprint: Epic 6 - Broadcast Quality Video Enhancement

### 4-Phase Workflow (with /clear for Fresh Context)

#### Current Story: _______________

- [ ] Phase 1: Create Story (`/create-story`)
- [ ] Run `/clear` (fresh context)
- [ ] Phase 2: Develop Story (`/dev-story`)
- [ ] Run `/clear` (fresh context)
- [ ] Phase 3+4: Code Review + Commit (run together, NO /clear between)
  - [ ] Run `/code-review` (type "yes" to accept story)
  - [ ] Fix all issues (let code-review handle it)
  - [ ] Review iteration 2 (if needed)
  - [ ] Review iteration 3 (if needed)
  - [ ] Review iteration 4 (if needed)
  - [ ] Review iteration 5 (if needed - human help after this)
  - [ ] Git Commit
- [ ] Story complete! (EXIT in testing mode, or /clear and continue to next story)

**TESTING MODE**: One story per cycle to verify workflow

### Epic 6 Story Progress

| Story | Title | Status |
|-------|-------|--------|
| 6-1 | define-direction-document-schema | done |
| 6-2 | implement-backward-compatibility-layer | done |
| 6-3 | update-script-generation-dual-output | done |
| 6-4 | update-tts-to-read-script-only | done |
| 6-5 | create-timestamp-extraction-package | review |
| 6-6 | implement-google-cloud-stt-integration | backlog |
| 6-7 | implement-estimated-timing-fallback | backlog |
| 6-8 | create-reference-test-audio-files | backlog |
| 6-9 | implement-timestamp-quality-gate | backlog |
| 6-10 | register-timestamp-stage-orchestrator | backlog |
| 6-11 | update-pipeline-data-flow-timestamps | backlog |
| 6-12 | add-timestamp-extraction-tests | backlog |
| 6-13 | define-motionconfig-interface | backlog |
| 6-14 | create-usemotion-hook | backlog |
| 6-15 | update-component-prop-interfaces | backlog |
| 6-16 | refactor-components-motion-support | backlog |
| 6-17 | create-kinetictext-component | backlog |
| 6-18 | update-techexplainer-motion-timing | backlog |
| 6-19 | create-audio-mixer-package | backlog |
| 6-20 | implement-voice-activity-detection | backlog |
| 6-21 | implement-music-selection | backlog |
| 6-22 | initialize-music-library | backlog |
| 6-23 | initialize-sfx-library | backlog |
| 6-24 | implement-audio-mix-pipeline | backlog |
| 6-25 | implement-audio-mixer-quality-gate | backlog |
| 6-26 | integrate-audio-mixer-visual-gen | backlog |
| 6-27 | create-broll-engine-package | backlog |
| 6-28 | implement-code-snippet-renderer | backlog |
| 6-29 | update-codehighlight-typing-effect | backlog |
| 6-30 | implement-browser-demo-templates | backlog |
| 6-31 | create-browserframe-component | backlog |
| 6-32 | update-timelinejson-dynamic-duration | backlog |
| 6-33 | update-scene-duration-calculation | backlog |
| 6-34 | update-remotion-composition-dynamic-duration | backlog |

### Workflow Per Story (Single Session with /clear)

All phases run in ONE session, using `/clear` for fresh context between phases:

```
Phase 1 (create-story)
    ↓
  /clear
    ↓
Phase 2 (dev-story)
    ↓
  /clear
    ↓
Phase 3 (code-review) → Phase 4 (commit)  [NO /clear between these]
    ↓
Story Complete!
    ↓
(If more stories: /clear → loop back to Phase 1)
(If no more stories or TESTING MODE: EXIT)
```

**Phase details**:
1. `/create-story` - creates story file, status → `ready-for-dev`
2. `/dev-story` - implement with TDD, status → `review`
3. `/code-review` - type "yes" to accept story, fix all issues
4. Git commit with `feat({package}): {title} (Story {key})`

### Completion Criteria

Epic 6 is complete when:
- All 34 stories (6-1 through 6-34) are marked `done`
- All stories have been committed
- All tests pass (`pnpm test`)
- Build succeeds (`pnpm build`)

### Notes

- Check sprint-status.yaml for current story status
- Stories in `review` status need `/code-review` first
- Stories in `ready-for-dev` need `/dev-story` first
- Stories in `backlog` need `/create-story` first
- Update this file when starting a new story
