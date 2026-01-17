import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { THEME } from '../theme';
import type { ComparisonChartProps } from '../types';

export const ComparisonChart: React.FC<ComparisonChartProps> = ({
  title = 'Comparison',
  data,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Default comparison data
  const comparison = data?.comparison ?? [
    { label: 'Before', value: 45 },
    { label: 'After', value: 85 },
  ];

  const barColor = style?.barColor ?? THEME.colors.primary;
  const comparisonColor = style?.comparisonColor ?? THEME.colors.accent;

  // Chart dimensions
  const chartWidth = 800;
  const chartHeight = 500;
  const chartX = (1920 - chartWidth) / 2;
  const chartY = 350;
  const maxValue = Math.max(...comparison.map((item) => item.value));

  // Bar dimensions
  const barWidth = 200;
  const barSpacing = chartWidth / comparison.length;

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

      {/* Chart */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        style={{ position: 'absolute' }}
      >
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((value) => {
          const y = chartY + chartHeight - (value / 100) * chartHeight;
          return (
            <g key={`grid-${value}`}>
              <line
                x1={chartX}
                y1={y}
                x2={chartX + chartWidth}
                y2={y}
                stroke={THEME.colors.backgroundLight}
                strokeWidth={1}
                opacity={0.3}
              />
              <text
                x={chartX - 20}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fill={THEME.colors.textMuted}
                fontSize={THEME.fontSizes.sm}
                fontFamily={THEME.fonts.body}
              >
                {value}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {comparison.map((item, index) => {
          const barX = chartX + index * barSpacing + (barSpacing - barWidth) / 2;
          const barHeight = (item.value / maxValue) * chartHeight;

          const delay = index * 20;
          const barProgress = spring({
            frame: frame - delay,
            fps,
            config: {
              damping: 100,
            },
          });

          const animatedHeight = barHeight * barProgress;
          const animatedY = chartY + chartHeight - animatedHeight;

          const color = index === 0 ? barColor : comparisonColor;

          return (
            <g key={`bar-${index}`}>
              {/* Bar background glow */}
              <rect
                x={barX - 4}
                y={animatedY - 4}
                width={barWidth + 8}
                height={animatedHeight + 4}
                fill={color}
                opacity={0.1}
                rx={THEME.borderRadius.md}
              />
              {/* Bar */}
              <rect
                x={barX}
                y={animatedY}
                width={barWidth}
                height={animatedHeight}
                fill={color}
                opacity={barProgress}
                rx={THEME.borderRadius.md}
              />
              {/* Value label */}
              <text
                x={barX + barWidth / 2}
                y={animatedY - 20}
                textAnchor="middle"
                fill={THEME.colors.text}
                fontSize={THEME.fontSizes['2xl']}
                fontFamily={THEME.fonts.heading}
                fontWeight={700}
                opacity={barProgress}
              >
                {item.value}
              </text>
              {/* Category label */}
              <text
                x={barX + barWidth / 2}
                y={chartY + chartHeight + 40}
                textAnchor="middle"
                fill={THEME.colors.textSecondary}
                fontSize={THEME.fontSizes.lg}
                fontFamily={THEME.fonts.body}
                fontWeight={600}
                opacity={barProgress}
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Percentage change indicator */}
      {comparison.length === 2 && (
        <div
          style={{
            position: 'absolute',
            top: chartY - 80,
            left: chartX + chartWidth / 2,
            transform: 'translateX(-50%)',
            fontFamily: THEME.fonts.heading,
            fontSize: THEME.fontSizes['3xl'],
            color: THEME.colors.success,
            fontWeight: 700,
            opacity: interpolate(frame, [30, 50], [0, 1], {
              extrapolateRight: 'clamp',
            }),
          }}
        >
          +{Math.round(((comparison[1].value - comparison[0].value) / comparison[0].value) * 100)}%
        </div>
      )}
    </AbsoluteFill>
  );
};
