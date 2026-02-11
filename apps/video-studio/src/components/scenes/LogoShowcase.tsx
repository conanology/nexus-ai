import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { useMotion } from '../../hooks/useMotion.js';
import { COLORS, withOpacity } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import { BackgroundGradient } from '../shared/BackgroundGradient.js';
import { GlowEffect } from '../shared/GlowEffect.js';
import type { SceneComponentProps } from '../../types/scenes.js';
import { getLogoEntry } from '@nexus-ai/asset-library';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CARD_STAGGER = 6; // frames between each card's entrance
const GLOW_PULSE_DURATION = 20; // frames for the glow pulse after card appears
const SEQUENTIAL_FADE_FRAMES = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ResolvedLogo {
  name: string;
  abbreviation: string;
  color: string;
  src?: string;
}

/** Returns true if src is a usable image URL (http/https/data URI) */
function isValidImageSrc(src?: string): boolean {
  if (!src) return false;
  return src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:');
}

function resolveLogo(logoName: string, src?: string): ResolvedLogo {
  // Only pass through src if it's a valid URL — bare filenames like "logo.png"
  // resolve to the Remotion dev server and crash the render.
  const safeSrc = isValidImageSrc(src) ? src : undefined;
  const entry = getLogoEntry(logoName);
  if (entry) {
    return { name: entry.name, abbreviation: entry.abbreviation, color: entry.color, src: safeSrc };
  }
  return {
    name: logoName,
    abbreviation: logoName.charAt(0).toUpperCase(),
    color: COLORS.accentPrimary,
    src: safeSrc,
  };
}

// ---------------------------------------------------------------------------
// Grid Mode
// ---------------------------------------------------------------------------

interface LogoCardProps {
  logo: ResolvedLogo;
  startFrame: number;
  frame: number;
  fps: number;
}

const LogoCard: React.FC<LogoCardProps> = ({ logo, startFrame, frame, fps }) => {
  const relativeFrame = Math.max(0, frame - startFrame);

  const scale = spring({
    frame: relativeFrame,
    fps,
    config: { damping: 12, stiffness: 200, mass: 0.8 },
    durationInFrames: 20,
  });

  // Brief glow pulse that peaks shortly after card appears
  const glowProgress = relativeFrame - 10; // starts 10 frames after card entrance
  const glowOpacity =
    glowProgress > 0 && glowProgress < GLOW_PULSE_DURATION
      ? interpolate(glowProgress, [0, GLOW_PULSE_DURATION / 2, GLOW_PULSE_DURATION], [0, 0.6, 0])
      : 0;

  const hasImage = !!logo.src;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.bgElevated,
        border: `1px solid ${logo.color}`,
        borderRadius: 16,
        padding: hasImage ? '20px 24px' : '32px 24px',
        minWidth: hasImage ? 160 : 180,
        height: hasImage ? 140 : undefined,
        transform: `scale(${scale})`,
        boxShadow: glowOpacity > 0
          ? `0 0 30px ${withOpacity(logo.color, glowOpacity)}, 0 0 60px ${withOpacity(logo.color, glowOpacity * 0.4)}`
          : 'none',
      }}
    >
      {hasImage ? (
        <>
          {/* White inner card ensures logo looks clean on dark background */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#ffffff',
              borderRadius: 12,
              padding: 12,
            }}
          >
            <Img
              src={logo.src!}
              style={{
                maxWidth: 80,
                maxHeight: 80,
                objectFit: 'contain',
              }}
            />
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 24,
              fontFamily: THEME.fonts.body,
              fontWeight: 400,
              color: COLORS.textPrimary,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {logo.name}
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              fontFamily: THEME.fonts.mono,
              color: logo.color,
              lineHeight: 1,
              marginBottom: 12,
            }}
          >
            {logo.abbreviation}
          </div>
          <div
            style={{
              fontSize: 24,
              fontFamily: THEME.fonts.body,
              fontWeight: 400,
              color: COLORS.textPrimary,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {logo.name}
          </div>
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sequential Mode
// ---------------------------------------------------------------------------

interface SequentialLogoProps {
  logo: ResolvedLogo;
  opacity: number;
}

const SequentialLogo: React.FC<SequentialLogoProps> = ({ logo, opacity }) => {
  const hasImage = !!logo.src;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        opacity,
        zIndex: 3,
      }}
    >
      {hasImage ? (
        <>
          {/* White inner card ensures logo looks clean on dark background */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#ffffff',
              borderRadius: 12,
              padding: 16,
            }}
          >
            <Img
              src={logo.src!}
              style={{
                maxWidth: 120,
                maxHeight: 120,
                objectFit: 'contain',
              }}
            />
          </div>
          <div
            style={{
              marginTop: 16,
              fontSize: 36,
              fontFamily: THEME.fonts.heading,
              fontWeight: 500,
              color: COLORS.textPrimary,
              textAlign: 'center',
            }}
          >
            {logo.name}
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              fontFamily: THEME.fonts.mono,
              color: logo.color,
              lineHeight: 1,
              marginBottom: 16,
            }}
          >
            {logo.abbreviation}
          </div>
          <div
            style={{
              fontSize: 36,
              fontFamily: THEME.fonts.heading,
              fontWeight: 500,
              color: COLORS.textPrimary,
              textAlign: 'center',
            }}
          >
            {logo.name}
          </div>
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const LogoShowcase: React.FC<SceneComponentProps<'logo-showcase'>> = (props) => {
  const { visualData, motion, screenshotImage } = props;
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);

  const { logos, layout } = visualData;
  const resolvedLogos = logos.map((l) => resolveLogo(l.name, l.src));

  if (layout === 'sequential') {
    const count = resolvedLogos.length;
    const durationPerLogo = durationInFrames / count;

    return (
      <AbsoluteFill>
        <BackgroundGradient variant="default" screenshotImage={screenshotImage} />

        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            ...motionStyles.entranceStyle,
            ...motionStyles.exitStyle,
          }}
        >
          {resolvedLogos.map((logo, i) => {
            const logoStart = i * durationPerLogo;
            const logoEnd = logoStart + durationPerLogo;

            // Fade in over first SEQUENTIAL_FADE_FRAMES, fade out over last SEQUENTIAL_FADE_FRAMES
            const fadeIn = interpolate(
              frame,
              [logoStart, logoStart + SEQUENTIAL_FADE_FRAMES],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            );
            const fadeOut = interpolate(
              frame,
              [logoEnd - SEQUENTIAL_FADE_FRAMES, logoEnd],
              [1, 0],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            );
            const opacity = Math.min(fadeIn, fadeOut);

            return (
              <React.Fragment key={i}>
                {opacity > 0 && (
                  <GlowEffect
                    color={logo.color}
                    intensity="medium"
                    size={300}
                    pulse={false}
                  />
                )}
                <SequentialLogo logo={logo} opacity={opacity} />
              </React.Fragment>
            );
          })}
        </div>
      </AbsoluteFill>
    );
  }

  // --- Grid mode ---
  const count = resolvedLogos.length;
  const cols = Math.ceil(Math.sqrt(count));

  return (
    <AbsoluteFill>
      <BackgroundGradient variant="default" screenshotImage={screenshotImage} />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 80,
          zIndex: 2,
          ...motionStyles.entranceStyle,
          ...motionStyles.exitStyle,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 32,
            justifyItems: 'center',
            alignItems: 'center',
          }}
        >
          {resolvedLogos.map((logo, i) => (
            <LogoCard
              key={i}
              logo={logo}
              startFrame={i * CARD_STAGGER}
              frame={frame}
              fps={fps}
            />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
