import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, random } from 'remotion';
import { THEME } from '../theme';
import type { NeuralNetworkAnimationProps } from '../types';

export const NeuralNetworkAnimation: React.FC<NeuralNetworkAnimationProps> = ({
  title = 'Neural Network',
  nodeCount = 12,
  data,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Generate nodes in a layered structure if not provided
  const nodes = (data?.nodes as Array<{ id: string; label: string; x: number; y: number }> | undefined) ?? generateNodes(nodeCount);
  const edges = data?.edges ?? generateEdges(nodes);

  // Animation progress
  const progress = spring({
    frame,
    fps,
    config: {
      damping: 100,
    },
  });

  const nodeColor = style?.nodeColor ?? THEME.colors.primary;
  const edgeColor = style?.edgeColor ?? THEME.colors.accent;

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

      {/* Neural Network Visualization */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        style={{ position: 'absolute' }}
      >
        {/* Edges/Connections */}
        {edges.map((edge, index) => {
          const fromNode = nodes.find((n) => n.id === edge.from);
          const toNode = nodes.find((n) => n.id === edge.to);
          if (!fromNode || !toNode) return null;

          const delay = index * 2;
          const edgeProgress = interpolate(
            frame - delay,
            [0, 30],
            [0, 1],
            { extrapolateRight: 'clamp' }
          );

          return (
            <line
              key={`edge-${index}`}
              x1={fromNode.x}
              y1={fromNode.y}
              x2={toNode.x}
              y2={toNode.y}
              stroke={edgeColor}
              strokeWidth={2 * edgeProgress}
              opacity={0.3 * edgeProgress}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node, index) => {
          const delay = index * 3;
          const nodeProgress = spring({
            frame: frame - delay,
            fps,
            config: {
              damping: 100,
            },
          });

          const scale = nodeProgress;
          const pulseScale = 1 + Math.sin(frame / 10 + index) * 0.1;

          return (
            <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
              {/* Outer glow */}
              <circle
                r={20 * scale * pulseScale}
                fill={nodeColor}
                opacity={0.2 * nodeProgress}
              />
              {/* Node circle */}
              <circle
                r={12 * scale}
                fill={nodeColor}
                opacity={nodeProgress}
              />
              {/* Inner highlight */}
              <circle
                r={6 * scale}
                fill={THEME.colors.primaryLight}
                opacity={0.8 * nodeProgress}
              />
            </g>
          );
        })}
      </svg>

      {/* Data flow particles */}
      {edges.slice(0, 5).map((edge, index) => {
        const fromNode = nodes.find((n) => n.id === edge.from);
        const toNode = nodes.find((n) => n.id === edge.to);
        if (!fromNode || !toNode) return null;

        const particleProgress = ((frame + index * 20) % 60) / 60;
        const x = interpolate(particleProgress, [0, 1], [fromNode.x, toNode.x]);
        const y = interpolate(particleProgress, [0, 1], [fromNode.y, toNode.y]);

        return (
          <div
            key={`particle-${index}`}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: THEME.colors.accentLight,
              boxShadow: THEME.shadows.glow,
              transform: 'translate(-50%, -50%)',
              opacity: progress,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// Helper function to generate nodes in a layered structure
function generateNodes(count: number): Array<{ id: string; label: string; x: number; y: number }> {
  const layers = Math.ceil(Math.sqrt(count));
  const nodes: Array<{ id: string; label: string; x: number; y: number }> = [];

  let nodeIndex = 0;
  for (let layer = 0; layer < layers && nodeIndex < count; layer++) {
    const nodesInLayer = Math.min(layers, count - nodeIndex);
    const layerX = 400 + layer * 300;

    for (let i = 0; i < nodesInLayer; i++) {
      const layerY = 300 + (i * 600) / (nodesInLayer + 1);
      nodes.push({
        id: `node-${nodeIndex}`,
        label: `N${nodeIndex}`,
        x: layerX,
        y: layerY,
      });
      nodeIndex++;
    }
  }

  return nodes;
}

// Helper function to generate edges between layers
function generateEdges(nodes: Array<{ id: string; x: number }>): Array<{ from: string; to: string }> {
  const edges: Array<{ from: string; to: string }> = [];

  // Group nodes by layer (x coordinate)
  const layers = new Map<number, string[]>();
  nodes.forEach((node) => {
    const x = node.x;
    if (!layers.has(x)) {
      layers.set(x, []);
    }
    layers.get(x)!.push(node.id);
  });

  const layerArray = Array.from(layers.values());

  // Connect nodes between adjacent layers
  for (let i = 0; i < layerArray.length - 1; i++) {
    const currentLayer = layerArray[i];
    const nextLayer = layerArray[i + 1];

    currentLayer.forEach((fromId) => {
      nextLayer.forEach((toId) => {
        // Create some connections (not all-to-all)
        // Use deterministic random based on node IDs
        const seed = `${fromId}-${toId}`;
        if (random(seed) > 0.4) {
          edges.push({ from: fromId, to: toId });
        }
      });
    });
  }

  return edges;
}
