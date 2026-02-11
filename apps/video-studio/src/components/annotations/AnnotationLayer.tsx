import React from 'react';
import { AbsoluteFill } from 'remotion';
import { HanddrawnCircle } from './HanddrawnCircle.js';
import { HanddrawnArrow } from './HanddrawnArrow.js';
import { HanddrawnUnderline } from './HanddrawnUnderline.js';
import { HanddrawnX } from './HanddrawnX.js';
import type { SceneAnnotation } from '../../types/scenes.js';

export interface AnnotationLayerProps {
  annotations: SceneAnnotation[];
  sceneDurationFrames: number;
}

export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({
  annotations,
}) => {
  if (!annotations || annotations.length === 0) return null;

  return (
    <AbsoluteFill style={{ zIndex: 8, pointerEvents: 'none' }}>
      <svg
        viewBox="0 0 1920 1080"
        width="1920"
        height="1080"
        style={{ position: 'absolute', inset: 0 }}
      >
        {annotations.map((annotation, index) => {
          switch (annotation.type) {
            case 'circle':
              return (
                <HanddrawnCircle
                  key={`annotation-${index}-circle`}
                  cx={annotation.cx}
                  cy={annotation.cy}
                  rx={annotation.rx}
                  ry={annotation.ry}
                  color={annotation.color}
                  delayFrames={annotation.delayFrames}
                  drawDurationFrames={annotation.drawDurationFrames}
                  rotation={annotation.rotation}
                />
              );
            case 'arrow':
              return (
                <HanddrawnArrow
                  key={`annotation-${index}-arrow`}
                  fromX={annotation.fromX}
                  fromY={annotation.fromY}
                  toX={annotation.toX}
                  toY={annotation.toY}
                  color={annotation.color}
                  delayFrames={annotation.delayFrames}
                  drawDurationFrames={annotation.drawDurationFrames}
                  curved={annotation.curved}
                />
              );
            case 'underline':
              return (
                <HanddrawnUnderline
                  key={`annotation-${index}-underline`}
                  x={annotation.x}
                  y={annotation.y}
                  width={annotation.width}
                  color={annotation.color}
                  delayFrames={annotation.delayFrames}
                  drawDurationFrames={annotation.drawDurationFrames}
                  style={annotation.style}
                />
              );
            case 'x-mark':
              return (
                <HanddrawnX
                  key={`annotation-${index}-xmark`}
                  cx={annotation.cx}
                  cy={annotation.cy}
                  size={annotation.size}
                  color={annotation.color}
                  delayFrames={annotation.delayFrames}
                  drawDurationFrames={annotation.drawDurationFrames}
                />
              );
            default:
              return null;
          }
        })}
      </svg>
    </AbsoluteFill>
  );
};
