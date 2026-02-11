# Claude Code Operations Manual

Reference for all available tools, workflows, and checklists when developing Nexus-AI.

## Available Custom Commands

| Command | Purpose |
|---------|---------|
| `/verify` | Full verification: tsc (4 packages) + tests + git status |
| `/test-package <name>` | Run vitest for a specific package (e.g., `/test-package visual-gen`) |
| `/render-test` | Execute E2E render test via `scripts/full-render-test.ts` |
| `/scene-check` | Type-check all scene-related packages (video-studio, director-agent, visual-gen, asset-library) |
| `/pipeline-status` | Show branch, commits, test summary, and file counts |

## Dev Scripts

| Script | Usage |
|--------|-------|
| `npx tsx scripts/dev/verify.ts` | Automated verify (tsc + tests + git status) |
| `npx tsx scripts/dev/render-clip.ts` | Render 10s test clip (3 scenes) |
| `npx tsx scripts/dev/check-imports.ts` | Detect circular dependencies |
| `npx tsx scripts/dev/bundle-report.ts` | Source file and line counts per package |

## Pre-Flight Checklists

### Before ANY Code Change
- [ ] Read the file(s) you're about to modify
- [ ] Understand existing patterns in that file
- [ ] Check if the function/component is used elsewhere: `Grep` for its name
- [ ] Know which packages will be affected (check dependency graph)

### After ANY Code Change
- [ ] Type-check affected packages: `cd packages/<name> && npx tsc --noEmit`
- [ ] Run tests for affected packages: `cd packages/<name> && npx vitest run`
- [ ] If scene types changed: rebuild director-agent (`cd packages/director-agent && npx tsc`)
- [ ] If visual-gen enrichers changed: run `/scene-check`
- [ ] Clean up unused imports (`noUnusedLocals: true`)

### Before ANY Commit
- [ ] `git diff` — review all changes
- [ ] `pnpm test` — confirm baseline unchanged (22/152, 37/3033)
- [ ] `git status` — no unintended files staged
- [ ] Commit message follows conventional format: `type(scope): description`

### Before ANY Render
- [ ] Check `.env.local` has `NEXUS_GEMINI_API_KEY`
- [ ] Verify `apps/video-studio/public/` has SFX/music files
- [ ] Confirm data URIs have been materialized (not in inputProps)
- [ ] Check scene schema uses `.passthrough()` in TechExplainer.tsx

## Debugging Workflows

### Rendering Issues
1. Check the error message — is it a bundle error or render error?
2. **Bundle error**: Verify `apps/video-studio/src/index.ts` exists and exports correctly
3. **Render error**: Check `publicDir` is set in `bundle()` call
4. **Missing visuals**: Check Zod `.passthrough()` on scene schema (TechExplainer.tsx:53)
5. **Black frames**: Check `SceneBackgroundImage` opacity (should be 0.50)
6. **Missing SFX**: Check `publicDir` points to `apps/video-studio/public/`

### Audio Sync Issues
1. Check TTS output duration matches expected (`durationSec` from `generateAudio()`)
2. Verify `applyEstimatedTimings()` got correct `audioDurationSec`
3. Check frame math: `durationInFrames = Math.ceil(durationSec * 30)`
4. Confirm no scenes have 0 frames: look for `Math.max(1, ...)` guards

### Test Failures
1. Run failing test in isolation: `cd packages/<name> && npx vitest run <test-file>`
2. Check if it's a pre-existing failure (37 known failures, mostly FirestoreClient mocks)
3. For new failures: check if you changed a function signature that tests mock
4. For import errors: verify `.js` extensions in all imports

### Director Agent Issues
1. Check `NEXUS_GEMINI_API_KEY` is set
2. Verify `packages/director-agent/dist/` exists (run `cd packages/director-agent && npx tsc`)
3. Check scene type is in the SceneType union in `scene-classifier.ts`
4. Check default visualData fallback exists for the scene type

## Enrichment Pipeline Debug Order

When images/overlays/annotations are missing, check each enrichment stage in order:

| # | Stage | Check |
|---|-------|-------|
| 1 | Logos | Is scene type `logo-showcase`? Are company names in visualData? |
| 2 | Audio | Does SCENE_SFX_MAP have the scene type? |
| 3 | Geo | Is scene type `map-animation`? Are country names resolvable? |
| 4 | Images | Is `NEXUS_GEMINI_API_KEY` set? Is scene type excluded? |
| 5 | Source screenshots | Is `topicData.url` threaded through? Playwright installed? |
| 6 | Company screenshots | Are company names detectable in narration? |
| 7 | Stock | Is `PEXELS_API_KEY` set? Does scene already have a screenshot? |
| 8 | Overlays | Is scene type `meme-reaction`? (only exclusion) |
| 9 | Annotations | Is scene type in EXCLUDED_TYPES set? |
| 10 | Memes | Is `GIPHY_API_KEY` set? Is scene type excluded? |

## Adding a New Scene Type — Step by Step

1. **`packages/director-agent/src/scene-classifier.ts`**
   - Add to `SceneType` union type
   - Add classification guidance in the system prompt
   - Add default `visualData` fallback in the switch statement
   - Add default `pacing` assignment

2. **`packages/script-gen/src/types.ts`**
   - Add to `SceneType` type

3. **`apps/video-studio/src/types/scenes.ts`**
   - Create `XxxVisualData` interface
   - Add to `VisualData` union

4. **`apps/video-studio/src/components/scenes/Xxx.tsx`**
   - Create scene component (follow existing patterns)
   - Accept `{ scene, fps }` props minimum

5. **`apps/video-studio/src/SceneRouter.tsx`**
   - Import new component
   - Add case to scene type switch
   - Decide: overlays? annotations? both?

6. **`packages/visual-gen/src/`** (if needed)
   - Update `annotation-enricher.ts` EXCLUDED_TYPES if annotations don't apply
   - Update `asset-fetcher.ts` if images should be excluded
   - Add SFX mapping in `packages/asset-library/src/audio-assets.ts`

7. **Rebuild + verify**:
   ```bash
   cd packages/director-agent && npx tsc
   cd apps/video-studio && npx tsc --noEmit
   cd packages/visual-gen && npx tsc --noEmit
   pnpm test
   ```

## Adding a New Enricher — Step by Step

1. Create `packages/visual-gen/src/xxx-enricher.ts`
2. Export main function: `enrichScenesWithXxx(scenes: Scene[]): Promise<Scene[]>`
3. Add to pipeline in `packages/visual-gen/src/asset-fetcher.ts` (order matters!)
4. Add tests in `packages/visual-gen/src/__tests__/xxx-enricher.test.ts`
5. Export from `packages/visual-gen/src/index.ts`
6. Type-check: `cd packages/visual-gen && npx tsc --noEmit`
7. Test: `cd packages/visual-gen && npx vitest run`

## MCP Servers Available

| Server | Purpose | Status |
|--------|---------|--------|
| Notion | Workspace search, page CRUD | Connected |
| Firecrawl | Web scraping, content extraction | Plugin |
| Playwright | Browser automation, screenshots | Plugin |
| Sonatype | Dependency analysis, version checks | Plugin |
| Chrome | Page reading, GIF recording | Connected |

## Recommended MCP Servers to Install

```bash
# Context7 — up-to-date library docs (Remotion, Zod, Vitest)
claude mcp add context7 -- cmd /c npx -y @upstash/context7-mcp@latest

# GitHub — PR/issue management
claude mcp add --transport http github https://api.githubcopilot.com/mcp/
```
