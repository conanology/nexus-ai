import React from 'react';
import { Composition } from 'remotion';
import { TechExplainer } from './compositions/TechExplainer';

/**
 * Sample timeline data for preview/testing
 */
const sampleTimeline = {
  audioDurationSec: 30,
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
        // Duration will be calculated from timeline, but we need a default
        // for the Remotion Studio. This is 30 seconds at 30fps.
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          timeline: sampleTimeline,
          // Sample audio URL - replace with actual audio in production
          audioUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', // Reliable sample
        }}
      />
    </>
  );
};
