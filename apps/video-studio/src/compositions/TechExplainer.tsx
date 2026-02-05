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
 * Zod schema for TechExplainer composition props
 * Supports EITHER legacy timeline OR new directionDocument input
 */
export const TechExplainerSchema = z.union([
  z.object({
    timeline: TimelineSchema,
    audioUrl: z.string(),
  }),
  z.object({
    directionDocument: DirectionDocumentSchema,
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
      backgroundColor: '#1a1a1a',
      color: '#fff',
      fontSize: 24,
      fontFamily: 'sans-serif',
    }}
  >
    Component not found: {componentName}
  </div>
);

/**
 * Maps a DirectionSegment to scene rendering data
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

  if (isDirectionMode(validated)) {
    // Direction document mode: iterate segments
    const scenes = validated.directionDocument.segments.map((segment: DirectionSegment) =>
      mapSegmentToScene(segment, fps)
    );

    return (
      <>
        <Audio src={validated.audioUrl} />
        {scenes.map((scene, index) => {
          const SceneComponent = COMPONENT_MAP[scene.componentName];

          if (!SceneComponent) {
            console.warn(
              `Component "${scene.componentName}" not found in COMPONENT_MAP. Available components:`,
              Object.keys(COMPONENT_MAP)
            );
            return (
              <Sequence key={index} from={scene.from} durationInFrames={scene.durationInFrames}>
                <UnknownComponentFallback componentName={scene.componentName} />
              </Sequence>
            );
          }

          return (
            <Sequence key={index} from={scene.from} durationInFrames={scene.durationInFrames}>
              <SceneComponent
                {...scene.templateProps}
                motion={scene.motion}
                wordTimings={scene.wordTimings}
                emphasis={scene.emphasis}
              />
            </Sequence>
          );
        })}
      </>
    );
  }

  // Legacy timeline mode: existing behavior unchanged
  return (
    <>
      <Audio src={validated.audioUrl} />
      {validated.timeline.scenes.map((scene, index) => {
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
