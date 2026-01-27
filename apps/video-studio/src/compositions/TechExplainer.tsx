import React from 'react';
import { Audio, Sequence, useVideoConfig } from 'remotion';
import { z } from 'zod';
import {
  NeuralNetworkAnimation,
  DataFlowDiagram,
  ComparisonChart,
  MetricsCounter,
  ProductMockup,
  CodeHighlight,
  BrandedTransition,
  LowerThird,
  KineticText,
} from '../components';

/**
 * Zod schema for TechExplainer composition props
 */
export const TechExplainerSchema = z.object({
  timeline: z.object({
    audioDurationSec: z.number(),
    scenes: z.array(
      z.object({
        component: z.string(),
        props: z.record(z.any()).optional(),
        startTime: z.number(),
        duration: z.number(),
      })
    ),
  }),
  audioUrl: z.string(),
});

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
  KineticText,
};

/**
 * TechExplainer Composition
 * Renders a video from a timeline JSON and audio file
 * Syncs visuals exactly to audio duration with 60fps animations
 */
export const TechExplainer: React.FC<TechExplainerProps> = ({ timeline, audioUrl }) => {
  const { fps } = useVideoConfig();

  // Validate props with Zod
  const validated = TechExplainerSchema.parse({ timeline, audioUrl });

  return (
    <>
      {/* Audio track */}
      <Audio src={validated.audioUrl} />

      {/* Render scenes as Sequences */}
      {validated.timeline.scenes.map((scene, index) => {
        // Convert seconds to frames
        const from = Math.round(scene.startTime * fps);
        const durationInFrames = Math.round(scene.duration * fps);

        // Get the component from the map
        const SceneComponent = COMPONENT_MAP[scene.component];

        // If component not found, render placeholder
        if (!SceneComponent) {
          console.warn(
            `Component "${scene.component}" not found in COMPONENT_MAP. Available components:`,
            Object.keys(COMPONENT_MAP)
          );
          return (
            <Sequence key={index} from={from} durationInFrames={durationInFrames}>
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
                Component not found: {scene.component}
              </div>
            </Sequence>
          );
        }

        // Render the component with props
        return (
          <Sequence key={index} from={from} durationInFrames={durationInFrames}>
            <SceneComponent {...(scene.props ?? {})} />
          </Sequence>
        );
      })}
    </>
  );
};
