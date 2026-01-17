import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { THEME } from '../theme';
import type { DataFlowDiagramProps } from '../types';

export const DataFlowDiagram: React.FC<DataFlowDiagramProps> = ({
  title = 'Data Flow',
  steps = ['Input', 'Process', 'Output'],
  data,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const nodes = data?.nodes ?? steps.map((step, i) => ({
    id: `step-${i}`,
    label: step,
  }));

  const flows = data?.flows ?? nodes.slice(0, -1).map((node, i) => ({
    from: node.id,
    to: nodes[i + 1].id,
  }));

  const primaryColor = style?.primaryColor ?? THEME.colors.primary;
  const arrowColor = style?.arrowColor ?? THEME.colors.accent;

  // Calculate positions for nodes in a horizontal flow
  const nodeWidth = 240;
  const nodeHeight = 80;
  const spacing = 180;
  const totalWidth = nodes.length * nodeWidth + (nodes.length - 1) * spacing;
  const startX = (1920 - totalWidth) / 2;
  const centerY = 540;

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.colors.background }}>
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: THEME.spacing['2xl'],
          left: THEME.spacing['2xl'],
          fontFamily: THEME.fonts.heading,
          fontSize: THEME.fontSizes['4xl'],
          color: THEME.colors.text,
          fontWeight: 700,
        }}
      >
        {title}
      </div>

      {/* Data Flow Visualization */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        style={{ position: 'absolute' }}
      >
        <defs>
          {/* Arrow marker */}
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3, 0 6"
              fill={arrowColor}
            />
          </marker>
        </defs>

        {/* Flow arrows */}
        {flows.map((flow, index) => {
          const fromIndex = nodes.findIndex((n) => n.id === flow.from);
          const toIndex = nodes.findIndex((n) => n.id === flow.to);

          const x1 = startX + fromIndex * (nodeWidth + spacing) + nodeWidth;
          const x2 = startX + toIndex * (nodeWidth + spacing);
          const y = centerY + nodeHeight / 2;

          const delay = fromIndex * 15;
          const arrowProgress = spring({
            frame: frame - delay,
            fps,
            config: {
              damping: 100,
            },
          });

          // Animated dash
          const dashProgress = ((frame + index * 10) % 60) / 60;
          const dashX = interpolate(dashProgress, [0, 1], [x1, x2]);

          return (
            <g key={`flow-${index}`}>
              {/* Flow line */}
              <line
                x1={x1}
                y1={y}
                x2={x2}
                y2={y}
                stroke={arrowColor}
                strokeWidth={3}
                markerEnd="url(#arrowhead)"
                opacity={0.6 * arrowProgress}
              />
              {/* Animated particle */}
              <circle
                cx={dashX}
                cy={y}
                r={6}
                fill={THEME.colors.accentLight}
                opacity={arrowProgress}
              />
            </g>
          );
        })}

        {/* Node boxes */}
        {nodes.map((node, index) => {
          const x = startX + index * (nodeWidth + spacing);
          const y = centerY;

          const delay = index * 15;
          const nodeProgress = spring({
            frame: frame - delay,
            fps,
            config: {
              damping: 100,
            },
          });

          const scale = nodeProgress;

          return (
            <g
              key={node.id}
              transform={`translate(${x + nodeWidth / 2}, ${y + nodeHeight / 2}) scale(${scale})`}
            >
              {/* Background glow */}
              <rect
                x={-nodeWidth / 2 - 4}
                y={-nodeHeight / 2 - 4}
                width={nodeWidth + 8}
                height={nodeHeight + 8}
                fill={primaryColor}
                opacity={0.2}
                rx={THEME.borderRadius.lg}
              />
              {/* Node box */}
              <rect
                x={-nodeWidth / 2}
                y={-nodeHeight / 2}
                width={nodeWidth}
                height={nodeHeight}
                fill={THEME.colors.backgroundLight}
                stroke={primaryColor}
                strokeWidth={3}
                rx={THEME.borderRadius.md}
                opacity={nodeProgress}
              />
              {/* Node label */}
              <text
                x={0}
                y={0}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={THEME.colors.text}
                fontSize={THEME.fontSizes.xl}
                fontFamily={THEME.fonts.body}
                fontWeight={600}
                opacity={nodeProgress}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
