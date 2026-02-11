import React from 'react';
import { Audio, Sequence, useVideoConfig } from 'remotion';
import { z } from 'zod';
import { DirectionDocumentSchema } from '../types';
import type { DirectionSegment, MotionConfig, WordTiming, EmphasisWord } from '../types';
import {
  NeuralNetworkAnimation,
  DataFlowDiagram,
  ComparisonChart,
  MetricsCounter,
  ProductMockup,
  CodeHighlight,
  BrandedTransition,
  LowerThird,
  TextOnGradient,
  KineticText,
  BrowserFrame,
} from '../components';
import { SceneRouter } from '../SceneRouter.js';
import { ColorGrade } from '../components/shared/ColorGrade.js';
import { SCENE_TYPES } from '../types/scenes.js';
import type { Scene, SceneType } from '../types/scenes.js';

/**
 * Legacy timeline schema for backward compatibility
 */
const TimelineSchema = z.object({
  audioDurationSec: z.number(),
  totalDurationFrames: z.number().optional(),
  scenes: z.array(
    z.object({
      component: z.string(),
      props: z.record(z.any()).optional(),
      startTime: z.number(),
      duration: z.number(),
    })
  ),
});

/**
 * V2-Director scenes schema: Scene[] from the Director Agent
 */
const ScenesSchema = z.object({
  scenes: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      startFrame: z.number(),
      endFrame: z.number(),
      content: z.string(),
      visualData: z.record(z.unknown()),
      transition: z.enum(['cut', 'crossfade', 'dissolve', 'wipe-left', 'slide-up']),
    }).passthrough()
  ),
  totalDurationFrames: z.number(),
  audioUrl: z.string(),
  wordTimings: z.array(z.object({
    word: z.string(),
    startTime: z.number(),
    endTime: z.number(),
    confidence: z.number().optional(),
  })).optional(),
});

/**
 * Zod schema for TechExplainer composition props
 * Supports: V2-director scenes, directionDocument, OR legacy timeline
 *
 * Order matters: ScenesSchema must come FIRST because Remotion merges
 * defaultProps (which include a sample timeline) with inputProps.
 * Without this order, the timeline variant would always match first
 * and strip the V2-Director fields.
 */
export const TechExplainerSchema = z.union([
  ScenesSchema,
  z.object({
    directionDocument: DirectionDocumentSchema,
    audioUrl: z.string(),
  }),
  z.object({
    timeline: TimelineSchema,
    audioUrl: z.string(),
  }),
]);

export type TechExplainerProps = z.infer<typeof TechExplainerSchema>;

/**
 * Component mapping for visual elements
 * Maps component names from timeline JSON to React components
 */
const COMPONENT_MAP: Record<string, React.FC<any>> = {
  NeuralNetworkAnimation,
  DataFlowDiagram,
  ComparisonChart,
  MetricsCounter,
  ProductMockup,
  CodeHighlight,
  BrandedTransition,
  LowerThird,
  TextOnGradient,
  KineticText,
  BrowserFrame,
};

/**
 * Scene data extracted from a DirectionSegment for rendering
 */
interface MappedScene {
  componentName: string;
  from: number;
  durationInFrames: number;
  templateProps: Record<string, unknown>;
  motion: MotionConfig;
  wordTimings?: WordTiming[];
  emphasis?: EmphasisWord[];
}

/**
 * Fallback component rendered when a scene references an unknown component name
 */
const UnknownComponentFallback: React.FC<{ componentName: string }> = ({ componentName }) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#0a0e1a',
      color: '#fff',
      fontSize: 24,
      fontFamily: 'sans-serif',
    }}
  >
    Component not found: {componentName}
  </div>
);

/**
 * Maps a DirectionSegment to scene rendering data (legacy V2 path)
 * Prefers actual timing (from STT) over estimated timing (from script-gen)
 */
export function mapSegmentToScene(segment: DirectionSegment, fps: number): MappedScene {
  const startSec = segment.timing.actualStartSec ?? segment.timing.estimatedStartSec ?? 0;
  const durationSec = segment.timing.actualDurationSec ?? segment.timing.estimatedDurationSec ?? 5;

  return {
    componentName: segment.visual.template,
    from: Math.round(startSec * fps),
    durationInFrames: Math.max(1, Math.round(durationSec * fps)),
    templateProps: segment.visual.templateProps ?? {},
    motion: segment.visual.motion,
    wordTimings: segment.timing.wordTimings,
    emphasis: segment.content.emphasis,
  };
}

/** Set of valid SceneType values for O(1) lookup */
const SCENE_TYPE_SET = new Set<string>(SCENE_TYPES);

/**
 * Converts DirectionSegments to Scene[] for the SceneRouter.
 * If a segment's template matches a valid SceneType, it's used directly.
 * Otherwise falls back to 'narration-default'.
 */
export function mapDirectionToScenes(segments: DirectionSegment[], fps: number): Scene[] {
  return segments.map((segment) => {
    const startSec = segment.timing.actualStartSec ?? segment.timing.estimatedStartSec ?? 0;
    const durationSec = segment.timing.actualDurationSec ?? segment.timing.estimatedDurationSec ?? 5;
    const startFrame = Math.round(startSec * fps);
    const endFrame = startFrame + Math.max(1, Math.round(durationSec * fps));

    const isSceneType = SCENE_TYPE_SET.has(segment.visual.template);

    return {
      id: segment.id,
      type: (isSceneType ? segment.visual.template : 'narration-default') as SceneType,
      startFrame,
      endFrame,
      content: segment.content.text,
      visualData: isSceneType
        ? (segment.visual.templateProps ?? {})
        : { backgroundVariant: 'gradient' as const },
      transition: 'cut' as const,
    };
  });
}

/**
 * Detects whether props use the legacy timeline or new directionDocument input
 */
function isDirectionMode(props: TechExplainerProps): props is { directionDocument: z.infer<typeof DirectionDocumentSchema>; audioUrl: string } {
  return 'directionDocument' in props;
}

/**
 * TechExplainer Composition
 * Renders a video from either a legacy timeline JSON or a DirectionDocument,
 * syncing visuals to audio with frame-accurate timing.
 */
export const TechExplainer: React.FC<TechExplainerProps> = (props) => {
  const { fps } = useVideoConfig();

  const validated = TechExplainerSchema.parse(props);

  // V2-Director scenes mode: Scene[] directly from Director Agent
  if ('scenes' in validated && Array.isArray(validated.scenes)) {
    return (
      <ColorGrade>
        <SceneRouter
          scenes={validated.scenes as Scene[]}
          audioUrl={validated.audioUrl}
          wordTimings={('wordTimings' in validated ? validated.wordTimings : undefined) as WordTiming[] | undefined}
        />
      </ColorGrade>
    );
  }

  if (isDirectionMode(validated)) {
    // Direction document mode: delegate to SceneRouter
    const scenes = mapDirectionToScenes(validated.directionDocument.segments, fps);
    return (
      <ColorGrade>
        <SceneRouter scenes={scenes} audioUrl={validated.audioUrl} />
      </ColorGrade>
    );
  }

  // Legacy timeline mode: existing behavior unchanged
  // At this point TypeScript knows only the timeline variant remains
  const timelineProps = validated as { timeline: z.infer<typeof TimelineSchema>; audioUrl: string };
  return (
    <>
      <Audio src={timelineProps.audioUrl} />
      {timelineProps.timeline.scenes.map((scene, index) => {
        const from = Math.round(scene.startTime * fps);
        const durationInFrames = Math.round(scene.duration * fps);
        const SceneComponent = COMPONENT_MAP[scene.component];

        if (!SceneComponent) {
          console.warn(
            `Component "${scene.component}" not found in COMPONENT_MAP. Available components:`,
            Object.keys(COMPONENT_MAP)
          );
          return (
            <Sequence key={index} from={from} durationInFrames={durationInFrames}>
              <UnknownComponentFallback componentName={scene.component} />
            </Sequence>
          );
        }

        return (
          <Sequence key={index} from={from} durationInFrames={durationInFrames}>
            <SceneComponent {...(scene.props ?? {})} />
          </Sequence>
        );
      })}
    </>
  );
};
