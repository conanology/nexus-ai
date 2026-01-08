# Story 2.10: Create Script Generation Stage

Status: done

## Story

As a developer,
I want to generate video scripts via multi-agent pipeline,
So that scripts are high-quality and optimized for video.

## Acceptance Criteria

1. **Given** research brief from Story 2.9
   **When** I implement the script generation stage
   **Then** `@nexus-ai/script-gen` package is created

2. **And** multi-agent pipeline executes per FR7:
   1. **Writer Agent**: Creates initial 1,200-1,800 word script
   2. **Critic Agent**: Reviews for clarity, accuracy, engagement
   3. **Optimizer Agent**: Refines based on critique

3. **And** each agent uses LLM provider with role-specific prompts

4. **And** script validation checks word count per FR8:
   - 1,200-1,800 words required
   - If outside range, regenerate with adjusted prompt per FR9
   - Maximum 3 regeneration attempts

5. **And** script includes embedded visual cues per FR10:
   - `[VISUAL: neural network animation]`
   - `[VISUAL: comparison chart]`
   - `[VISUAL: product mockup]`

6. **And** script includes pronunciation hints per FR10:
   - `[PRONOUNCE: Mixtral = "mix-trahl"]`

7. **And** all script drafts stored to Cloud Storage

8. **And** stage uses `executeStage` wrapper with `script-gen` quality gate

## Tasks / Subtasks

- [x] Task 1: Create @nexus-ai/script-gen package (AC: #1)
  - [x] Create package structure
  - [x] Set up exports

- [x] Task 2: Implement Writer Agent (AC: #2)
  - [x] Create writer prompt template
  - [x] Target 1200-1800 words
  - [x] Include visual cue instructions
  - [x] Include pronunciation hint instructions

- [x] Task 3: Implement Critic Agent (AC: #2, #3)
  - [x] Create critic prompt template
  - [x] Review for clarity
  - [x] Review for accuracy
  - [x] Review for engagement
  - [x] Produce structured critique

- [x] Task 4: Implement Optimizer Agent (AC: #2, #3)
  - [x] Create optimizer prompt template
  - [x] Apply critique feedback
  - [x] Maintain visual cues
  - [x] Polish final script

- [x] Task 5: Implement validation and regeneration (AC: #4)
  - [x] Count words in output
  - [x] Check 1200-1800 range
  - [x] Regenerate if out of range
  - [x] Max 3 attempts
  - [x] Adjust prompts on retry

- [x] Task 6: Store all drafts (AC: #7)
  - [x] Store v1-writer.md
  - [x] Store v2-critic.md
  - [x] Store v3-optimizer.md
  - [x] Store final script.md

- [x] Task 7: Integrate with executeStage (AC: #8)
  - [x] Use script-gen quality gate
  - [x] Track costs for all 3 agents

## Dev Notes

### Multi-Agent Pipeline

```
Research Brief → Writer → Critic → Optimizer → Final Script
                   ↓          ↓          ↓
              v1-writer  v2-critic  v3-optimizer
```

### Agent Prompts Summary

**Writer**: Create engaging script from research
**Critic**: Identify improvements, rate sections
**Optimizer**: Apply fixes, polish delivery

### Visual Cue Format

```markdown
[VISUAL: type - description]
Examples:
[VISUAL: neural network animation]
[VISUAL: comparison chart - GPT-4 vs Claude]
[VISUAL: metrics counter - 1M parameters]
```

### Pronunciation Hint Format

```markdown
[PRONOUNCE: term = "phonetic"]
Examples:
[PRONOUNCE: Mixtral = "mix-trahl"]
[PRONOUNCE: LLaMA = "lah-mah"]
```

### Word Count Validation

```typescript
const wordCount = script.split(/\s+/).length;
if (wordCount < 1200 || wordCount > 1800) {
  // Regenerate with adjusted prompt
  // Max 3 attempts
}
```

### Storage Paths

```
{date}/script-drafts/v1-writer.md
{date}/script-drafts/v2-critic.md
{date}/script-drafts/v3-optimizer.md
{date}/script.md (final)
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Created @nexus-ai/script-gen package
- Implemented 3-agent pipeline: Writer, Critic, Optimizer
- Each agent has role-specific prompts
- Word count validation with regeneration (max 3 attempts)
- Visual cues and pronunciation hints included
- All drafts stored to Cloud Storage
- Uses script-gen quality gate

### File List

**Created/Modified:**
- `nexus-ai/packages/script-gen/package.json`
- `nexus-ai/packages/script-gen/tsconfig.json`
- `nexus-ai/packages/script-gen/src/types.ts`
- `nexus-ai/packages/script-gen/src/agents/writer.ts`
- `nexus-ai/packages/script-gen/src/agents/critic.ts`
- `nexus-ai/packages/script-gen/src/agents/optimizer.ts`
- `nexus-ai/packages/script-gen/src/agents/index.ts`
- `nexus-ai/packages/script-gen/src/script-gen.ts`
- `nexus-ai/packages/script-gen/src/index.ts`

### Dependencies

- **Upstream Dependencies:** Story 2.9 (Research), Story 1.5 (LLM Provider)
- **Downstream Dependencies:** Story 2.11-2.13 (Pronunciation), Story 3.1 (TTS)
