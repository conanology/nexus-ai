import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS, withOpacity } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import { BackgroundGradient } from '../shared/BackgroundGradient.js';
import { ForegroundScreenshot } from '../shared/ForegroundScreenshot.js';
import type { SceneComponentProps } from '../../types/scenes.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FRAME_W = 1920;
const FRAME_H = 1080;
const CHART_PADDING = { top: 160, right: 120, bottom: 140, left: 120 };
const BAR_GAP_RATIO = 0.25; // gap between bars as fraction of bar width
const BAR_STAGGER = 3; // frames between sequential bar reveals
const LINE_DOT_RADIUS = 8;
const LINE_STROKE_WIDTH = 4;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DynamicChart: React.FC<SceneComponentProps<'dynamic-chart'>> = (props) => {
  const { visualData, backgroundImage, screenshotImage, screenshotDisplayMode } = props;
  const isForeground = screenshotDisplayMode === 'foreground' && screenshotImage;
  const bgScreenshot = !isForeground ? screenshotImage : undefined;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { chartType, title, data, unit, animationStyle = 'sequential' } = visualData;
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  const chartW = FRAME_W - CHART_PADDING.left - CHART_PADDING.right;
  const chartH = FRAME_H - CHART_PADDING.top - CHART_PADDING.bottom;

  // Title animation
  const titleSpring = spring({ frame, fps, config: { damping: 14, stiffness: 200 } });

  return (
    <AbsoluteFill>
      <BackgroundGradient variant="cool" grid gridOpacity={0.03} backgroundImage={backgroundImage} screenshotImage={bgScreenshot} />

      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: THEME.fonts.heading,
          fontSize: 52,
          fontWeight: 900,
          color: COLORS.textPrimary,
          textTransform: 'uppercase',
          letterSpacing: 2,
          opacity: titleSpring,
          transform: `translateY(${(1 - titleSpring) * -20}px)`,
          zIndex: 3,
          textShadow: `0 0 20px ${withOpacity(COLORS.accentPrimary, 0.4)}`,
        }}
      >
        {title}
        {unit && (
          <span style={{ fontSize: 28, fontWeight: 500, color: COLORS.textSecondary, marginLeft: 12 }}>
            ({unit})
          </span>
        )}
      </div>

      {/* Chart area */}
      <svg
        width={FRAME_W}
        height={FRAME_H}
        viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
        style={{ position: 'absolute', inset: 0, zIndex: 2 }}
      >
        {/* Glow filter */}
        <defs>
          <filter id="chartGlow">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Baseline */}
        <line
          x1={CHART_PADDING.left}
          y1={CHART_PADDING.top + chartH}
          x2={CHART_PADDING.left + chartW}
          y2={CHART_PADDING.top + chartH}
          stroke={withOpacity(COLORS.textSecondary, 0.3)}
          strokeWidth={2}
        />

        {/* Horizontal grid lines */}
        {[0.25, 0.5, 0.75].map((frac) => (
          <line
            key={frac}
            x1={CHART_PADDING.left}
            y1={CHART_PADDING.top + chartH * (1 - frac)}
            x2={CHART_PADDING.left + chartW}
            y2={CHART_PADDING.top + chartH * (1 - frac)}
            stroke={withOpacity(COLORS.textSecondary, 0.08)}
            strokeWidth={1}
            strokeDasharray="8 8"
          />
        ))}

        {chartType === 'bar'
          ? renderBarChart(data, maxValue, chartW, chartH, frame, fps, animationStyle)
          : renderLineChart(data, maxValue, chartW, chartH, frame, fps, animationStyle)}
      </svg>

      {/* Bar labels (HTML for better text rendering) */}
      {chartType === 'bar' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }}>
          {data.map((d, i) => {
            const barTotalW = chartW / data.length;
            const barW = barTotalW * (1 - BAR_GAP_RATIO);
            const barX = CHART_PADDING.left + barTotalW * i + (barTotalW - barW) / 2;
            const barH = (d.value / maxValue) * chartH;

            const delay = animationStyle === 'sequential' ? i * BAR_STAGGER : 0;
            const s = spring({ frame: Math.max(0, frame - delay - 2), fps, config: { damping: 12, stiffness: 180 } });

            return (
              <React.Fragment key={i}>
                {/* Label below bar */}
                <div
                  style={{
                    position: 'absolute',
                    left: barX,
                    top: CHART_PADDING.top + chartH + 12,
                    width: barW,
                    textAlign: 'center',
                    fontFamily: THEME.fonts.mono,
                    fontSize: Math.min(24, Math.max(16, 400 / data.length)),
                    fontWeight: 600,
                    color: COLORS.textSecondary,
                    opacity: s,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {d.label}
                </div>
                {/* Value above bar */}
                <div
                  style={{
                    position: 'absolute',
                    left: barX,
                    top: CHART_PADDING.top + chartH - barH * s - 36,
                    width: barW,
                    textAlign: 'center',
                    fontFamily: THEME.fonts.mono,
                    fontSize: 28,
                    fontWeight: 900,
                    color: COLORS.accentPrimary,
                    opacity: s,
                    textShadow: `0 0 12px ${withOpacity(COLORS.accentPrimary, 0.5)}`,
                  }}
                >
                  {d.value.toLocaleString()}{unit ? ` ${unit}` : ''}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Line chart labels */}
      {chartType === 'line' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }}>
          {data.map((d, i) => {
            const x = CHART_PADDING.left + (data.length > 1 ? (chartW / (data.length - 1)) * i : chartW / 2);
            const y = CHART_PADDING.top + chartH - (d.value / maxValue) * chartH;
            const pointFrame = animationStyle === 'sequential'
              ? Math.max(0, frame - i * BAR_STAGGER - 5)
              : Math.max(0, frame - 5);
            const s = spring({ frame: pointFrame, fps, config: { damping: 14, stiffness: 200 } });

            return (
              <React.Fragment key={i}>
                <div
                  style={{
                    position: 'absolute',
                    left: x - 60,
                    top: y - 42,
                    width: 120,
                    textAlign: 'center',
                    fontFamily: THEME.fonts.mono,
                    fontSize: 24,
                    fontWeight: 900,
                    color: COLORS.accentPrimary,
                    opacity: s,
                    textShadow: `0 0 12px ${withOpacity(COLORS.accentPrimary, 0.5)}`,
                  }}
                >
                  {d.value.toLocaleString()}{unit ? ` ${unit}` : ''}
                </div>
                <div
                  style={{
                    position: 'absolute',
                    left: x - 60,
                    top: CHART_PADDING.top + chartH + 12,
                    width: 120,
                    textAlign: 'center',
                    fontFamily: THEME.fonts.mono,
                    fontSize: Math.min(22, Math.max(14, 300 / data.length)),
                    fontWeight: 600,
                    color: COLORS.textSecondary,
                    opacity: s,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {d.label}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {isForeground && <ForegroundScreenshot src={screenshotImage} />}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Bar Chart SVG Renderer
// ---------------------------------------------------------------------------

function renderBarChart(
  data: Array<{ label: string; value: number }>,
  maxValue: number,
  chartW: number,
  chartH: number,
  frame: number,
  fps: number,
  animationStyle: 'sequential' | 'simultaneous',
): React.ReactNode {
  const barTotalW = chartW / data.length;
  const barW = barTotalW * (1 - BAR_GAP_RATIO);

  return data.map((d, i) => {
    const barX = CHART_PADDING.left + barTotalW * i + (barTotalW - barW) / 2;
    const barMaxH = (d.value / maxValue) * chartH;
    const delay = animationStyle === 'sequential' ? i * BAR_STAGGER : 0;

    const s = spring({
      frame: Math.max(0, frame - delay),
      fps,
      config: { damping: 10, stiffness: 160, mass: 0.7 },
    });

    const barH = barMaxH * s;
    const barY = CHART_PADDING.top + chartH - barH;

    return (
      <rect
        key={i}
        x={barX}
        y={barY}
        width={barW}
        height={Math.max(0, barH)}
        rx={4}
        fill={COLORS.accentPrimary}
        fillOpacity={0.85}
        filter="url(#chartGlow)"
      />
    );
  });
}

// ---------------------------------------------------------------------------
// Line Chart SVG Renderer
// ---------------------------------------------------------------------------

function renderLineChart(
  data: Array<{ label: string; value: number }>,
  maxValue: number,
  chartW: number,
  chartH: number,
  frame: number,
  fps: number,
  animationStyle: 'sequential' | 'simultaneous',
): React.ReactNode {
  if (data.length < 2) return null;

  const points = data.map((d, i) => ({
    x: CHART_PADDING.left + (chartW / (data.length - 1)) * i,
    y: CHART_PADDING.top + chartH - (d.value / maxValue) * chartH,
  }));

  // Build full path
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Compute total path length for stroke-dasharray animation
  let totalLen = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    totalLen += Math.sqrt(dx * dx + dy * dy);
  }

  // Line draw progress
  const drawDuration = animationStyle === 'sequential' ? (data.length - 1) * BAR_STAGGER + 10 : 12;
  const drawProgress = interpolate(frame, [2, 2 + drawDuration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const dashOffset = totalLen * (1 - drawProgress);

  return (
    <>
      {/* Glow line (wider, dimmer) */}
      <path
        d={pathD}
        fill="none"
        stroke={withOpacity(COLORS.accentPrimary, 0.3)}
        strokeWidth={LINE_STROKE_WIDTH * 3}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={totalLen}
        strokeDashoffset={dashOffset}
      />
      {/* Main line */}
      <path
        d={pathD}
        fill="none"
        stroke={COLORS.accentPrimary}
        strokeWidth={LINE_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={totalLen}
        strokeDashoffset={dashOffset}
      />
      {/* Data point dots */}
      {points.map((p, i) => {
        const delay = animationStyle === 'sequential' ? i * BAR_STAGGER + 3 : 3;
        const dotSpring = spring({
          frame: Math.max(0, frame - delay),
          fps,
          config: { damping: 12, stiffness: 200 },
        });
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={LINE_DOT_RADIUS * dotSpring}
            fill={COLORS.accentPrimary}
            stroke={COLORS.bgDeepDark}
            strokeWidth={3}
            filter="url(#chartGlow)"
          />
        );
      })}
    </>
  );
}
