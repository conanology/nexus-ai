import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { useMotion } from '../../hooks/useMotion.js';
import { COLORS, withOpacity } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import { BackgroundGradient } from '../shared/BackgroundGradient.js';
import { DrawingLine } from '../shared/DrawingLine.js';
import type { SceneComponentProps } from '../../types/scenes.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FRAME_W = 1920;
const FRAME_H = 1080;
const SAFE_ZONE = 80;
const USABLE_W = FRAME_W - SAFE_ZONE * 2;
const USABLE_H = FRAME_H - SAFE_ZONE * 2;

const NODE_STAGGER = 8;
const EDGE_STAGGER = 12;
const EDGE_DRAW_DURATION = 20;

const BASE_NODE_W = 200;
const BASE_NODE_H = 90;
const MIN_NODE_W = 140;
const MIN_NODE_H = 70;

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

interface NodePosition {
  id: string;
  x: number;
  y: number;
}

type LayoutMode = 'horizontal' | 'vertical' | 'hub-spoke';

function computeNodePositions(
  nodes: Array<{ id: string }>,
  layout: LayoutMode,
): NodePosition[] {
  const n = nodes.length;
  if (n === 0) return [];

  if (n === 1) {
    return [{ id: nodes[0].id, x: FRAME_W / 2, y: FRAME_H / 2 }];
  }

  switch (layout) {
    case 'horizontal':
      return nodes.map((node, i) => ({
        id: node.id,
        x: SAFE_ZONE + (USABLE_W / (n - 1)) * i,
        y: FRAME_H / 2,
      }));

    case 'vertical':
      return nodes.map((node, i) => ({
        id: node.id,
        x: FRAME_W / 2,
        y: SAFE_ZONE + (USABLE_H / (n - 1)) * i,
      }));

    case 'hub-spoke': {
      const centerX = FRAME_W / 2;
      const centerY = FRAME_H / 2;
      const radius = Math.min(USABLE_W, USABLE_H) * 0.35;
      const spokeCount = n - 1;

      const positions: NodePosition[] = [
        { id: nodes[0].id, x: centerX, y: centerY },
      ];

      for (let i = 0; i < spokeCount; i++) {
        const angle = (i / spokeCount) * 2 * Math.PI - Math.PI / 2; // start from top
        positions.push({
          id: nodes[i + 1].id,
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        });
      }

      return positions;
    }
  }
}

/**
 * Compute the intersection point of a line from center of a rectangle
 * to a target point, with the rectangle border.
 */
function rectEdgeIntersection(
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  tx: number,
  ty: number,
): { x: number; y: number } {
  const dx = tx - cx;
  const dy = ty - cy;

  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  // Scale factor to reach rectangle edge
  const scaleX = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);

  return {
    x: cx + dx * scale,
    y: cy + dy * scale,
  };
}

function resolveEdgeEndpoints(
  fromId: string,
  toId: string,
  posMap: Map<string, NodePosition>,
  nodeW: number,
  nodeH: number,
): { from: { x: number; y: number }; to: { x: number; y: number } } | null {
  const fromPos = posMap.get(fromId);
  const toPos = posMap.get(toId);
  if (!fromPos || !toPos) return null;

  const hw = nodeW / 2 + 4; // small gap
  const hh = nodeH / 2 + 4;

  return {
    from: rectEdgeIntersection(fromPos.x, fromPos.y, hw, hh, toPos.x, toPos.y),
    to: rectEdgeIntersection(toPos.x, toPos.y, hw, hh, fromPos.x, fromPos.y),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const Diagram: React.FC<SceneComponentProps<'diagram'>> = (props) => {
  const { visualData, motion, backgroundImage } = props;
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);

  const { nodes, edges, layout } = visualData;
  const nodeCount = nodes.length;

  // Responsive node sizing
  const scaleFactor = Math.min(1, 6 / Math.max(nodeCount, 1));
  const nodeW = Math.max(MIN_NODE_W, Math.round(BASE_NODE_W * scaleFactor));
  const nodeH = Math.max(MIN_NODE_H, Math.round(BASE_NODE_H * scaleFactor));
  const labelFontSize = scaleFactor < 1 ? 24 : 28;

  // Compute positions
  const positions = useMemo(
    () => computeNodePositions(nodes, layout),
    [nodes, layout],
  );
  const posMap = useMemo(() => {
    const m = new Map<string, NodePosition>();
    for (const p of positions) m.set(p.id, p);
    return m;
  }, [positions]);

  // Edge endpoints
  const edgeData = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        endpoints: resolveEdgeEndpoints(edge.from, edge.to, posMap, nodeW, nodeH),
      })),
    [edges, posMap, nodeW, nodeH],
  );

  // Timing: edges start after all nodes are visible
  const edgeStartFrame = nodeCount * NODE_STAGGER + 15;

  return (
    <AbsoluteFill>
      <BackgroundGradient variant="cool" grid gridOpacity={0.04} backgroundImage={backgroundImage} />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          ...motionStyles.entranceStyle,
          ...motionStyles.exitStyle,
        }}
      >
        {/* SVG edge layer (behind nodes) */}
        <svg
          width={FRAME_W}
          height={FRAME_H}
          viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
          style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}
        >
          {edgeData.map((edge, j) => {
            if (!edge.endpoints) return null;
            return (
              <DrawingLine
                key={`${edge.from}-${edge.to}`}
                from={edge.endpoints.from}
                to={edge.endpoints.to}
                color={COLORS.accentPrimary}
                glowColor={COLORS.accentPrimary}
                strokeWidth={2}
                delayFrames={edgeStartFrame + j * EDGE_STAGGER}
                durationFrames={EDGE_DRAW_DURATION}
              />
            );
          })}
        </svg>

        {/* Nodes (above edges) */}
        {nodes.map((node, i) => {
          const pos = posMap.get(node.id);
          if (!pos) return null;

          const nodeDelay = i * NODE_STAGGER;
          const nodeFrame = Math.max(0, frame - nodeDelay);

          const springVal = spring({
            frame: nodeFrame,
            fps,
            config: { damping: 12, mass: 0.5, stiffness: 150 },
          });

          const nodeScale = interpolate(springVal, [0, 1], [0, 1]);
          const nodeOpacity = interpolate(springVal, [0, 0.3], [0, 1], {
            extrapolateRight: 'clamp',
          });

          return (
            <div
              key={node.id}
              style={{
                position: 'absolute',
                left: pos.x - nodeW / 2,
                top: pos.y - nodeH / 2,
                width: nodeW,
                height: nodeH,
                borderRadius: 12,
                backgroundColor: COLORS.bgElevated,
                border: `1px solid ${COLORS.accentPrimary}`,
                boxShadow: `0 0 12px ${withOpacity(COLORS.accentPrimary, 0.15)}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                transform: `scale(${nodeScale})`,
                opacity: nodeOpacity,
                zIndex: 3,
              }}
            >
              {node.icon && (
                <span style={{ fontSize: 24, marginBottom: 4 }}>{node.icon}</span>
              )}
              <span
                style={{
                  fontSize: labelFontSize,
                  fontFamily: THEME.fonts.heading,
                  fontWeight: 500,
                  color: COLORS.textPrimary,
                  textAlign: 'center',
                  padding: '0 12px',
                  lineHeight: 1.2,
                }}
              >
                {node.label}
              </span>
            </div>
          );
        })}

        {/* Edge labels (HTML overlay, above SVG) */}
        {edgeData.map((edge, j) => {
          if (!edge.label || !edge.endpoints) return null;

          const labelDelay = edgeStartFrame + j * EDGE_STAGGER + EDGE_DRAW_DURATION;
          const labelOpacity = interpolate(
            frame,
            [labelDelay, labelDelay + 10],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          const midX = (edge.endpoints.from.x + edge.endpoints.to.x) / 2;
          const midY = (edge.endpoints.from.y + edge.endpoints.to.y) / 2;

          return (
            <div
              key={`label-${edge.from}-${edge.to}`}
              style={{
                position: 'absolute',
                left: midX,
                top: midY - 14,
                transform: 'translateX(-50%)',
                fontSize: 20,
                fontFamily: THEME.fonts.body,
                fontWeight: 400,
                color: COLORS.textSecondary,
                opacity: labelOpacity,
                backgroundColor: withOpacity(COLORS.bgBase, 0.8),
                padding: '2px 8px',
                borderRadius: 4,
                zIndex: 2,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {edge.label}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
