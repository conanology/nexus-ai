import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, useVideoConfig } from 'remotion';
import { THEME } from '../theme';
import type { BrandedTransitionProps } from '../types';
import { useMotion } from '../hooks/useMotion.js';

export const BrandedTransition: React.FC<BrandedTransitionProps> = ({
  type = 'wipe',
  direction = 'right',
  data,
  style,
  motion,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);

  const transitionType = data?.transitionType ?? type;
  const color = style?.color ?? THEME.colors.primary;

  // Transition progress (0 to 1)
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <div
        style={{
          width: '100%',
          height: '100%',
          ...motionStyles.entranceStyle,
          ...motionStyles.exitStyle,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            ...motionStyles.emphasisStyle,
          }}
        >
          {transitionType === 'wipe' && (
            <WipeTransition progress={progress} direction={direction} color={color} />
          )}
          {transitionType === 'fade' && (
            <FadeTransition progress={progress} color={color} />
          )}
          {transitionType === 'slide' && (
            <SlideTransition progress={progress} direction={direction} color={color} />
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Wipe transition component
const WipeTransition: React.FC<{
  progress: number;
  direction: string;
  color: string;
}> = ({ progress, direction, color }) => {
  const getWipeStyle = () => {
    switch (direction) {
      case 'right':
        return {
          left: 0,
          top: 0,
          width: `${progress * 100}%`,
          height: '100%',
        };
      case 'left':
        return {
          right: 0,
          top: 0,
          width: `${progress * 100}%`,
          height: '100%',
        };
      case 'down':
        return {
          left: 0,
          top: 0,
          width: '100%',
          height: `${progress * 100}%`,
        };
      case 'up':
        return {
          left: 0,
          bottom: 0,
          width: '100%',
          height: `${progress * 100}%`,
        };
      default:
        return {
          left: 0,
          top: 0,
          width: `${progress * 100}%`,
          height: '100%',
        };
    }
  };

  return (
    <>
      {/* Wipe overlay */}
      <div
        style={{
          position: 'absolute',
          background: `linear-gradient(135deg, ${color}, ${THEME.colors.secondary})`,
          ...getWipeStyle(),
        }}
      />

      {/* Leading edge glow */}
      <div
        style={{
          position: 'absolute',
          ...(direction === 'right' && {
            left: `${progress * 100}%`,
            top: 0,
            width: 100,
            height: '100%',
            transform: 'translateX(-50%)',
          }),
          ...(direction === 'left' && {
            right: `${progress * 100}%`,
            top: 0,
            width: 100,
            height: '100%',
            transform: 'translateX(50%)',
          }),
          ...(direction === 'down' && {
            left: 0,
            top: `${progress * 100}%`,
            width: '100%',
            height: 100,
            transform: 'translateY(-50%)',
          }),
          ...(direction === 'up' && {
            left: 0,
            bottom: `${progress * 100}%`,
            width: '100%',
            height: 100,
            transform: 'translateY(50%)',
          }),
          background: `radial-gradient(ellipse, ${color}80 0%, transparent 70%)`,
          filter: 'blur(30px)',
          opacity: progress,
        }}
      />

      {/* NEXUS-AI logo reveal */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontFamily: THEME.fonts.heading,
          fontSize: THEME.fontSizes['8xl'],
          fontWeight: 800,
          color: THEME.colors.text,
          opacity: interpolate(progress, [0.3, 0.5, 0.7, 0.9], [0, 1, 1, 0]),
          textShadow: `0 0 40px ${color}`,
        }}
      >
        NEXUS-AI
      </div>
    </>
  );
};

// Fade transition component
const FadeTransition: React.FC<{
  progress: number;
  color: string;
}> = ({ progress, color }) => {
  return (
    <>
      {/* Gradient fade overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle, ${color}, ${THEME.colors.background})`,
          opacity: interpolate(progress, [0, 0.5, 1], [0, 1, 0]),
        }}
      />

      {/* Particle burst effect */}
      {Array.from({ length: 20 }).map((_, i) => {
        const angle = (i / 20) * Math.PI * 2;
        const distance = progress * 800;
        const x = 960 + Math.cos(angle) * distance;
        const y = 540 + Math.sin(angle) * distance;
        const opacity = interpolate(progress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: THEME.colors.accentLight,
              opacity,
              boxShadow: THEME.shadows.glow,
            }}
          />
        );
      })}

      {/* Center logo */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${interpolate(progress, [0.2, 0.5, 0.8], [0, 1.2, 0])})`,
          fontFamily: THEME.fonts.heading,
          fontSize: THEME.fontSizes['8xl'],
          fontWeight: 800,
          color: THEME.colors.text,
          opacity: interpolate(progress, [0.2, 0.4, 0.6, 0.8], [0, 1, 1, 0]),
          textShadow: `0 0 40px ${color}`,
        }}
      >
        NEXUS-AI
      </div>
    </>
  );
};

// Slide transition component
const SlideTransition: React.FC<{
  progress: number;
  direction: string;
  color: string;
}> = ({ progress, direction, color }) => {
  const getSlideTransform = () => {
    const distance = 2000;
    switch (direction) {
      case 'right':
        return `translateX(${-distance + progress * distance}px)`;
      case 'left':
        return `translateX(${distance - progress * distance}px)`;
      case 'down':
        return `translateY(${-distance + progress * distance}px)`;
      case 'up':
        return `translateY(${distance - progress * distance}px)`;
      default:
        return `translateX(${-distance + progress * distance}px)`;
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: -100,
        background: `linear-gradient(135deg, ${color}, ${THEME.colors.secondary}, ${THEME.colors.accent})`,
        transform: getSlideTransform(),
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Logo */}
      <div
        style={{
          fontFamily: THEME.fonts.heading,
          fontSize: THEME.fontSizes['8xl'],
          fontWeight: 800,
          color: THEME.colors.text,
          textShadow: `0 0 40px ${THEME.colors.background}`,
        }}
      >
        NEXUS-AI
      </div>

      {/* Geometric patterns */}
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', opacity: 0.1 }}
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <circle
            key={i}
            cx={200 + i * 200}
            cy={540}
            r={100}
            fill="none"
            stroke={THEME.colors.text}
            strokeWidth={2}
          />
        ))}
      </svg>
    </div>
  );
};
