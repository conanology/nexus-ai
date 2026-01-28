import React from 'react';
import { Composition } from 'remotion';
import type { CalculateMetadataFunction } from 'remotion';
import { TechExplainer } from './compositions/TechExplainer';
import type { TechExplainerProps } from './compositions/TechExplainer';

const FPS = 30;
const DEFAULT_PREVIEW_DURATION_FRAMES = 9000; // 5 minutes at 30fps for Remotion Studio preview

/**
 * Resolves composition duration dynamically from props.
 * Priority: timeline.totalDurationFrames > audioDurationSec * fps > 5-min default
 */
export const calculateTechExplainerMetadata: CalculateMetadataFunction<TechExplainerProps> = ({
  props,
}) => {
  // Timeline mode: prefer totalDurationFrames
  if ('timeline' in props && props.timeline) {
    const { totalDurationFrames, audioDurationSec } = props.timeline;
    if (totalDurationFrames && totalDurationFrames > 0) {
      return { durationInFrames: totalDurationFrames };
    }
    return { durationInFrames: Math.ceil(audioDurationSec * FPS) };
  }

  // Direction document mode: use metadata.estimatedDurationSec
  if ('directionDocument' in props && props.directionDocument) {
    const audioDuration = props.directionDocument.metadata.estimatedDurationSec;
    return { durationInFrames: Math.ceil(audioDuration * FPS) };
  }

  // Default: 5-minute preview
  return { durationInFrames: DEFAULT_PREVIEW_DURATION_FRAMES };
};

/**
 * Sample timeline data for preview/testing
 */
const sampleTimeline = {
  audioDurationSec: 30,
  totalDurationFrames: 900, // 30 sec at 30fps
  scenes: [
    {
      component: 'NeuralNetworkAnimation',
      props: {
        title: 'Neural Network Architecture',
        nodeCount: 15,
      },
      startTime: 0,
      duration: 5,
    },
    {
      component: 'DataFlowDiagram',
      props: {
        title: 'Data Processing Pipeline',
        steps: ['Input', 'Transform', 'Analyze', 'Output'],
      },
      startTime: 5,
      duration: 5,
    },
    {
      component: 'ComparisonChart',
      props: {
        title: 'Performance Comparison',
        data: {
          comparison: [
            { label: 'Before', value: 45 },
            { label: 'After', value: 92 },
          ],
        },
      },
      startTime: 10,
      duration: 5,
    },
    {
      component: 'MetricsCounter',
      props: {
        title: 'Accuracy Score',
        value: 98.7,
        unit: '%',
        data: {
          start: 0,
          end: 98.7,
          label: 'Model Accuracy',
        },
      },
      startTime: 15,
      duration: 5,
    },
    {
      component: 'CodeHighlight',
      props: {
        title: 'Implementation Example',
        code: `function predict(input) {
  const model = loadModel();
  const result = model.predict(input);
  return result;
}`,
        language: 'javascript',
      },
      startTime: 20,
      duration: 5,
    },
    {
      component: 'LowerThird',
      props: {
        text: 'Source: Research Paper 2026',
        subtitle: 'Nature Machine Intelligence',
      },
      startTime: 25,
      duration: 5,
    },
  ],
};

/**
 * Remotion Root Component
 * Registers all video compositions
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TechExplainer"
        component={TechExplainer}
        durationInFrames={DEFAULT_PREVIEW_DURATION_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{
          timeline: sampleTimeline,
          audioUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        }}
        calculateMetadata={calculateTechExplainerMetadata}
      />
    </>
  );
};
