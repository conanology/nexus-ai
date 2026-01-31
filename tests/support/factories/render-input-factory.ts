/**
 * Render input data factory.
 *
 * Generates unique, parallel-safe render request data.
 * Override any field to express test intent explicitly.
 */

export type RenderInput = {
  pipelineId: string;
  timelineUrl: string;
  audioUrl: string;
  resolution: string;
};

export type RenderOutput = {
  videoUrl: string;
  duration: number;
  fileSize: number;
};

let counter = 0;

function uniqueDateId(): string {
  counter += 1;
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}-${counter}`;
}

export function createRenderInput(
  overrides: Partial<RenderInput> = {},
): RenderInput {
  const id = uniqueDateId();
  return {
    pipelineId: id,
    timelineUrl: `gs://nexus-test-bucket/${id}/scenes.json`,
    audioUrl: `gs://nexus-test-bucket/${id}/audio.wav`,
    resolution: '1080p',
    ...overrides,
  };
}

export function createRenderOutput(
  overrides: Partial<RenderOutput> = {},
): RenderOutput {
  const id = uniqueDateId();
  return {
    videoUrl: `gs://nexus-test-bucket/${id}/render/video.mp4`,
    duration: 120, // 2 minutes default
    fileSize: 50_000_000, // 50MB default
    ...overrides,
  };
}

/**
 * Create a render input with a small/short video (for quality gate edge cases).
 */
export function createShortRenderInput(
  overrides: Partial<RenderInput> = {},
): RenderInput {
  return createRenderInput({
    ...overrides,
  });
}

/**
 * Create a render output that would fail quality gate (file too small).
 */
export function createFailingQualityOutput(
  overrides: Partial<RenderOutput> = {},
): RenderOutput {
  return createRenderOutput({
    fileSize: 100, // 100 bytes - way too small
    duration: 60, // 60 seconds
    ...overrides,
  });
}
