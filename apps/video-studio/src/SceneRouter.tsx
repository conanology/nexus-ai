import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { NarrationDefault } from './components/scenes/NarrationDefault.js';
import { TextEmphasis } from './components/scenes/TextEmphasis.js';
import { FullScreenText } from './components/scenes/FullScreenText.js';
import { StatCallout } from './components/scenes/StatCallout.js';
import { Diagram } from './components/scenes/Diagram.js';
import { Comparison } from './components/scenes/Comparison.js';
import { LogoShowcase } from './components/scenes/LogoShowcase.js';
import { ChapterBreak } from './components/scenes/ChapterBreak.js';
import { Timeline } from './components/scenes/Timeline.js';
import { Quote } from './components/scenes/Quote.js';
import { ListReveal } from './components/scenes/ListReveal.js';
import { CodeBlock } from './components/scenes/CodeBlock.js';
import { IntroSequence } from './components/scenes/IntroSequence.js';
import { OutroSequence } from './components/scenes/OutroSequence.js';
import { MemeReaction } from './components/scenes/MemeReaction.js';
import { MapAnimation } from './components/scenes/MapAnimation.js';
import { ScrollingCapture } from './components/scenes/ScrollingCapture.js';
import { DynamicChart } from './components/scenes/DynamicChart.js';
import { ColdOpen } from './components/scenes/ColdOpen.js';
// AnimatedCaptions disabled — YouTube auto-generates captions
// import { AnimatedCaptions } from './components/overlays/AnimatedCaptions.js';
import { OverlayRenderer } from './components/overlays/OverlayRenderer.js';
import { AnnotationLayer } from './components/annotations/AnnotationLayer.js';
import type { Scene, SceneType, SceneComponentProps, StatCalloutVisualData, TextEmphasisVisualData } from './types/scenes.js';
import type { WordTiming } from './types.js';
import { getVideoStyleConfig } from './utils/style-profile.js';

// -----------------------------------------------------------------------------
// Scene Component Registry
// -----------------------------------------------------------------------------

export const SCENE_REGISTRY: Record<SceneType, React.FC<SceneComponentProps<any>>> = {
  'intro':             IntroSequence,
  'chapter-break':     ChapterBreak,
  'narration-default': NarrationDefault,
  'text-emphasis':     TextEmphasis,
  'full-screen-text':  FullScreenText,
  'stat-callout':      StatCallout,
  'comparison':        Comparison,
  'diagram':           Diagram,
  'logo-showcase':     LogoShowcase,
  'timeline':          Timeline,
  'quote':             Quote,
  'list-reveal':       ListReveal,
  'code-block':        CodeBlock,
  'meme-reaction':     MemeReaction,
  'map-animation':     MapAnimation,
  'scrolling-capture': ScrollingCapture,
  'dynamic-chart':     DynamicChart,
  'outro':             OutroSequence,
};

// -----------------------------------------------------------------------------
// Transition Configuration
// -----------------------------------------------------------------------------

type TransitionType = NonNullable<Scene['transition']>;

/** Base frame counts per transition before style-profile scaling. */
const BASE_TRANSITION_FRAMES: Record<TransitionType, number> = {
  'cut':        0,
  'slide-left': 3,
  'slam':       2,
  'wipe-down':  3,
  'split':      3,
  'zoom-in':    3,
  'pop-in':     3,
};

const STYLE_CONFIG = getVideoStyleConfig();

const TRANSITION_FRAMES: Record<TransitionType, number> = (Object.keys(BASE_TRANSITION_FRAMES) as TransitionType[]).reduce(
  (acc, key) => {
    const base = BASE_TRANSITION_FRAMES[key];
    acc[key] = key === 'cut'
      ? 0
      : Math.min(
          STYLE_CONFIG.maxTransitionFrames,
          Math.max(1, Math.round(base * STYLE_CONFIG.transitionFrameMultiplier)),
        );
    return acc;
  },
  {} as Record<TransitionType, number>,
);

const CLAMP = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

// -----------------------------------------------------------------------------
// SceneEnvelope — applies kinetic entrance/exit transitions to scene content
// -----------------------------------------------------------------------------

interface SceneEnvelopeProps {
  enterTransition: TransitionType;
  exitTransition: TransitionType;
  durationFrames: number;
  children: React.ReactNode;
}

/**
 * Wraps scene content with kinetic entrance/exit transition animations.
 *
 * - slide-left: translateX(100% → 0) with ease-out cubic
 * - slam: scale(1.15→1.0) + sine shake over 4 frames
 * - wipe-down: clipPath inset reveal from top
 * - split: opacity fade (Comparison handles internal panel slide)
 * - zoom-in: opacity fade (CodeBlock handles internal zoom)
 * - pop-in: spring overshoot 0→1.2→1.0 + opacity
 * - dissolve: REMOVED — all transitions are kinetic or hard cut
 * - cut: no animation
 *
 * Exit: all transitions use hard cuts — the incoming scene covers the outgoing one.
 */
const SceneEnvelope: React.FC<SceneEnvelopeProps> = ({
  enterTransition,
  children,
}) => {
  const frame = useCurrentFrame();
  const enterFrames = TRANSITION_FRAMES[enterTransition];

  let opacity = 1;
  let transform: string | undefined;
  let clipPath: string | undefined;

  // --- Entrance animations ---
  if (enterFrames > 0 && frame < enterFrames) {
    const t = interpolate(frame, [0, enterFrames], [0, 1], CLAMP);

    switch (enterTransition) {
      case 'slide-left': {
        // Ease-out quartic: 1 - (1-t)^4 — snappier deceleration for kinetic feel
        const eased = 1 - Math.pow(1 - t, 4);
        transform = `translateX(${(1 - eased) * 100}%)`;
        break;
      }
      case 'slam': {
        // Scale down from 1.15 to 1.0 + sine shake
        const scale = 1.15 - 0.15 * t;
        const shake = Math.sin(frame * Math.PI * 2.5) * STYLE_CONFIG.slamShakePx * (1 - t);
        transform = `scale(${scale}) translateX(${shake}px)`;
        break;
      }
      case 'wipe-down':
        // Reveal from top: inset(X% 0 0 0) where X goes 100→0
        clipPath = `inset(${(1 - t) * 100}% 0 0 0)`;
        break;
      case 'split':
      case 'zoom-in':
        // Simple opacity fade — the component handles its own internal animation
        opacity = t;
        break;
      case 'pop-in': {
        // Spring overshoot: 0→1.2→1.0
        const popT = t < 0.25
          ? interpolate(t, [0, 0.25], [0, 1], CLAMP)
          : 1;
        opacity = popT;
        const scaleVal = t < 0.6
          ? interpolate(t, [0, 0.6], [0, STYLE_CONFIG.popOvershootScale], CLAMP)
          : interpolate(t, [0.6, 1], [STYLE_CONFIG.popOvershootScale, 1.0], CLAMP);
        transform = `scale(${scaleVal})`;
        break;
      }
      // dissolve removed — all transitions are kinetic or hard cut
    }
  }

  // --- Exit animations ---
  // All transitions use hard cuts on exit — incoming scene covers outgoing.
  // No dissolve fade-out needed (dissolve eliminated).

  const style: React.CSSProperties = { opacity };
  if (transform) style.transform = transform;
  if (clipPath) style.clipPath = clipPath;

  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};

// -----------------------------------------------------------------------------
// SceneRouter
// -----------------------------------------------------------------------------

export interface ImpactWord {
  word: string;
  sceneId: string;
  frameOffset: number;
  intensity: 'low' | 'medium' | 'high';
}

export interface SceneRouterProps {
  scenes: Scene[];
  audioUrl: string;
  audioOffsetFrames?: number;
  wordTimings?: WordTiming[];
  impactWords?: ImpactWord[];
}

// -----------------------------------------------------------------------------
// ImpactFlash — 2-frame white flash overlay triggered by impact words
// -----------------------------------------------------------------------------

const FLASH_INTENSITY: Record<ImpactWord['intensity'], number> = {
  low: 0.08,
  medium: 0.12,
  high: 0.15,
};

const ImpactFlash: React.FC<{ intensity: ImpactWord['intensity'] }> = ({ intensity }) => {
  const frame = useCurrentFrame();
  const maxOpacity = FLASH_INTENSITY[intensity];
  // 2-frame flash: peak at frame 0, fade by frame 2
  const opacity = interpolate(frame, [0, 1, 2], [maxOpacity, maxOpacity * 0.5, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: 'white',
        opacity,
        zIndex: 100,
        pointerEvents: 'none',
      }}
    />
  );
};

/** SFX volume (~-8dB — punchy but not overpowering) */
const SFX_VOLUME = 0.40;

/** Transition SFX volume (~-12dB — subtler than scene SFX, just marks the cut) */
const TRANSITION_SFX_VOLUME = 0.25;

/** Background music volume (subtle but audible under narration) */
const MUSIC_VOLUME = 0.20;

/** Map transitions to their characteristic SFX */
const TRANSITION_SFX: Partial<Record<TransitionType, string>> = {
  'slide-left': 'whoosh-in',
  'slam':       'impact-hard',
  'wipe-down':  'transition',
  'pop-in':     'whoosh-in',
  'split':      'whoosh-in',
  'zoom-in':    'reveal',
};

function sfxUrl(name: string): string {
  return staticFile(`audio/sfx/${name}.wav`);
}

function musicUrl(name: string): string {
  return staticFile(`audio/music/${name}.wav`);
}

export const SceneRouter: React.FC<SceneRouterProps> = ({ scenes, audioUrl, audioOffsetFrames = 0, impactWords }) => {
  const { fps } = useVideoConfig();
  const totalDurationFrames = scenes.length > 0
    ? Math.max(...scenes.map((s) => s.endFrame))
    : 0;

  const musicTrack = scenes.find((s) => s.musicTrack)?.musicTrack;
  const introScene = scenes.find((s) => s.type === 'intro');
  const musicStartFrame = introScene ? introScene.startFrame : 0;
  const musicDuration = totalDurationFrames - musicStartFrame;

  return (
    <>
      {/* Root-level narration audio (offset compensates for systematic timing drift) */}
      <Audio src={audioUrl} startFrom={audioOffsetFrames} />

      {/* Background music — starts at intro scene, not during cold open */}
      {musicTrack && musicDuration > 0 && (
        <Sequence from={musicStartFrame} durationInFrames={musicDuration}>
          <Audio src={musicUrl(musicTrack)} volume={MUSIC_VOLUME} loop />
        </Sequence>
      )}

      {/* Render each scene with transition envelopes */}
      {scenes.map((scene, index) => {
        const durationInFrames = scene.endFrame - scene.startFrame;
        const enterTransition: TransitionType = scene.transition ?? 'cut';
        const nextScene = index < scenes.length - 1 ? scenes[index + 1] : undefined;
        const exitTransition: TransitionType = nextScene?.transition ?? 'cut';

        // Cold open scenes use the ColdOpen wrapper
        if (scene.isColdOpen) {
          return (
            <Sequence
              key={scene.id}
              from={scene.startFrame}
              durationInFrames={durationInFrames}
            >
              <SceneEnvelope
                enterTransition="cut"
                exitTransition={exitTransition}
                durationFrames={durationInFrames}
              >
                <ColdOpen
                  hook={{
                    text: scene.content,
                    sceneType: scene.type as 'stat-callout' | 'text-emphasis',
                    visualData: scene.visualData as StatCalloutVisualData | TextEmphasisVisualData,
                  }}
                  durationFrames={durationInFrames}
                />
              </SceneEnvelope>
            </Sequence>
          );
        }

        const Component = SCENE_REGISTRY[scene.type];

        return (
          <Sequence
            key={scene.id}
            from={scene.startFrame}
            durationInFrames={durationInFrames}
          >
            <SceneEnvelope
              enterTransition={enterTransition}
              exitTransition={exitTransition}
              durationFrames={durationInFrames}
            >
              <Component
                visualData={scene.visualData}
                content={scene.content}
                backgroundImage={scene.backgroundImage}
                screenshotImage={scene.screenshotImage}
                screenshotDisplayMode={scene.screenshotDisplayMode}
                sourceMetadata={scene.sourceMetadata}
                pacing={scene.pacing}
              />
              {scene.type !== 'meme-reaction' && scene.type !== 'map-animation' && scene.type !== 'dynamic-chart' && scene.annotations && scene.annotations.length > 0 && (
                <AnnotationLayer
                  annotations={scene.annotations}
                  sceneDurationFrames={durationInFrames}
                  suppressForHighlight={!!scene.highlightText}
                />
              )}
              {scene.type !== 'meme-reaction' && scene.overlays && scene.overlays.length > 0 && (
                <OverlayRenderer overlays={scene.overlays} fps={fps} sceneDuration={durationInFrames} />
              )}
            </SceneEnvelope>
          </Sequence>
        );
      })}

      {/* Per-scene SFX */}
      {scenes.map((scene) =>
        scene.sfx?.map((sfxName) => (
          <Sequence
            key={`sfx-${scene.id}-${sfxName}`}
            from={scene.startFrame}
            durationInFrames={scene.endFrame - scene.startFrame}
          >
            <Audio src={sfxUrl(sfxName)} volume={SFX_VOLUME} />
          </Sequence>
        )),
      )}

      {/* Transition SFX — plays when a scene enters with a non-cut transition.
          Skipped if the scene already has the same SFX in its own sfx array. */}
      {scenes.map((scene) => {
        const trans: TransitionType = scene.transition ?? 'cut';
        const transSfx = TRANSITION_SFX[trans];
        if (!transSfx) return null;
        // Avoid double-play: skip if scene already has this SFX
        if (scene.sfx?.includes(transSfx)) return null;
        const dur = scene.endFrame - scene.startFrame;
        return (
          <Sequence
            key={`trans-sfx-${scene.id}`}
            from={scene.startFrame}
            durationInFrames={dur}
          >
            <Audio src={sfxUrl(transSfx)} volume={TRANSITION_SFX_VOLUME} />
          </Sequence>
        );
      })}

      {/* Impact word flashes — 2-frame white flash overlays at key dramatic moments */}
      {impactWords?.map((iw) => {
        const scene = scenes.find((s) => s.id === iw.sceneId);
        if (!scene) return null;
        const absoluteFrame = scene.startFrame + iw.frameOffset;
        return (
          <Sequence
            key={`impact-${iw.sceneId}-${iw.frameOffset}`}
            from={absoluteFrame}
            durationInFrames={3}
          >
            <ImpactFlash intensity={iw.intensity} />
          </Sequence>
        );
      })}

      {/* Baked-in captions DISABLED — YouTube auto-generates captions that viewers
         can toggle on/off. Baked-in captions competed with overlays, annotations,
         and scene content for bottom-of-frame space. */}
    </>
  );
};
