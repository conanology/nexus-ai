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
import { ColdOpen } from './components/scenes/ColdOpen.js';
// AnimatedCaptions disabled — YouTube auto-generates captions
// import { AnimatedCaptions } from './components/overlays/AnimatedCaptions.js';
import { OverlayRenderer } from './components/overlays/OverlayRenderer.js';
import { AnnotationLayer } from './components/annotations/AnnotationLayer.js';
import type { Scene, SceneType, SceneComponentProps, StatCalloutVisualData, TextEmphasisVisualData } from './types/scenes.js';
import type { WordTiming } from './types.js';

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
  'outro':             OutroSequence,
};

// -----------------------------------------------------------------------------
// Transition Configuration
// -----------------------------------------------------------------------------

type TransitionType = NonNullable<Scene['transition']>;

/** Number of frames each transition type uses for entrance/exit animations. */
const TRANSITION_FRAMES: Record<TransitionType, number> = {
  'cut':        0,
  'crossfade':  8,   // ~0.27s at 30fps — quick dissolve through black
  'dissolve':   20,  // ~0.67s at 30fps — deliberate fade through black
  'wipe-left':  10,  // ~0.33s
  'slide-up':   10,  // ~0.33s
};

const CLAMP = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

// -----------------------------------------------------------------------------
// SceneEnvelope — applies entrance/exit transitions to scene content
// -----------------------------------------------------------------------------

interface SceneEnvelopeProps {
  enterTransition: TransitionType;
  exitTransition: TransitionType;
  durationFrames: number;
  children: React.ReactNode;
}

/**
 * Wraps scene content with entrance/exit transition animations.
 *
 * - crossfade / dissolve: opacity fade in/out (dissolve is longer, more deliberate)
 * - wipe-left: clipPath reveals content from left to right on entrance
 * - slide-up: content slides up from below on entrance
 * - cut: no animation
 *
 * Exit animations mirror entrance: opacity fade out for crossfade/dissolve,
 * no exit animation for wipe/slide (the incoming scene covers the outgoing one).
 */
const SceneEnvelope: React.FC<SceneEnvelopeProps> = ({
  enterTransition,
  exitTransition,
  durationFrames,
  children,
}) => {
  const frame = useCurrentFrame();
  const enterFrames = TRANSITION_FRAMES[enterTransition];
  const exitFrames = TRANSITION_FRAMES[exitTransition];

  let opacity = 1;
  let transform: string | undefined;
  let clipPath: string | undefined;

  // --- Entrance animations ---
  if (enterFrames > 0 && frame < enterFrames) {
    const t = interpolate(frame, [0, enterFrames], [0, 1], CLAMP);

    switch (enterTransition) {
      case 'crossfade':
      case 'dissolve':
        opacity = t;
        break;
      case 'wipe-left':
        // Reveal from left: inset(0 X% 0 0) where X goes 100→0
        clipPath = `inset(0 ${(1 - t) * 100}% 0 0)`;
        break;
      case 'slide-up':
        opacity = t;
        transform = `translateY(${(1 - t) * 8}%)`;
        break;
    }
  }

  // --- Exit animations (only for opacity-based transitions) ---
  if (exitFrames > 0 && frame > durationFrames - exitFrames) {
    const t = interpolate(
      frame,
      [durationFrames - exitFrames, durationFrames],
      [1, 0],
      CLAMP,
    );

    switch (exitTransition) {
      case 'crossfade':
      case 'dissolve':
        opacity *= t;
        break;
      // wipe-left and slide-up: the incoming scene covers us, no exit animation needed
    }
  }

  const style: React.CSSProperties = { opacity };
  if (transform) style.transform = transform;
  if (clipPath) style.clipPath = clipPath;

  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};

// -----------------------------------------------------------------------------
// SceneRouter
// -----------------------------------------------------------------------------

export interface SceneRouterProps {
  scenes: Scene[];
  audioUrl: string;
  wordTimings?: WordTiming[];
}

/** SFX volume (quieter than narration) */
const SFX_VOLUME = 0.4;

/** Background music volume (barely audible under narration) */
const MUSIC_VOLUME = 0.12;

function sfxUrl(name: string): string {
  return staticFile(`audio/sfx/${name}.wav`);
}

function musicUrl(name: string): string {
  return staticFile(`audio/music/${name}.wav`);
}

export const SceneRouter: React.FC<SceneRouterProps> = ({ scenes, audioUrl }) => {
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
      {/* Root-level narration audio */}
      <Audio src={audioUrl} />

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
              />
              {scene.type !== 'meme-reaction' && scene.type !== 'map-animation' && scene.annotations && scene.annotations.length > 0 && (
                <AnnotationLayer annotations={scene.annotations} sceneDurationFrames={durationInFrames} />
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

      {/* Baked-in captions DISABLED — YouTube auto-generates captions that viewers
         can toggle on/off. Baked-in captions competed with overlays, annotations,
         and scene content for bottom-of-frame space. */}
    </>
  );
};
