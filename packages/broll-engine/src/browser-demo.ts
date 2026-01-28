import type {
  BrowserBRollConfig,
  BrowserAction,
  BrowserTemplateId,
} from '@nexus-ai/script-gen';
import type {
  BrowserDemoProps,
  BrowserDemoContent,
  BrowserDemoElement,
} from './types.js';

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_FPS = 30;
const CLICK_DURATION_FRAMES = 10;
const TYPE_SPEED = 20; // chars per second for type actions
const SCROLL_SPEED = 200; // pixels per second
const HIGHLIGHT_FADE_FRACTION = 0.15; // fraction of action duration for fade in/out

// ── Action Timeline Types ──────────────────────────────────────────────────────

export interface TimelineEntry {
  action: BrowserAction;
  startFrame: number;
  endFrame: number;
}

export interface ActiveActionState {
  entry: TimelineEntry;
  progress: number;
}

export interface InterpolatedState {
  cursor?: { x: number; y: number; visible: boolean; clicking: boolean };
  scrollY: number;
  activeHighlight?: { target: string; opacity: number };
  typedChars?: { target: string; count: number };
}

// ── Template Content Definitions ───────────────────────────────────────────────

interface TemplateDefinition {
  elements: BrowserDemoElement[];
  actions: BrowserAction[];
}

function getApiRequestTemplate(durationFrames: number, fps: number): TemplateDefinition {
  const safeFps = fps > 0 ? fps : DEFAULT_FPS;
  const clickFrames = Math.floor((CLICK_DURATION_FRAMES / DEFAULT_FPS) * safeFps);
  const segmentFrames = Math.floor(durationFrames / 4);

  const elements: BrowserDemoElement[] = [
    { id: 'url-input', type: 'input', content: 'https://api.example.com/data', position: { x: 20, y: 60 } },
    { id: 'send-btn', type: 'button', content: 'Send', position: { x: 400, y: 60 } },
    { id: 'loading', type: 'text', content: 'Loading...', position: { x: 20, y: 120 } },
    { id: 'response', type: 'code-block', content: '{ "status": 200, "data": [...] }', position: { x: 20, y: 160 } },
  ];

  const actions: BrowserAction[] = [
    { type: 'click', target: '#send-btn', delay: 0, duration: clickFrames },
    { type: 'wait', delay: 0, duration: segmentFrames },
    { type: 'highlight', target: '#response', delay: 0, duration: segmentFrames },
  ];

  return { elements, actions };
}

function getFormSubmitTemplate(durationFrames: number, fps: number): TemplateDefinition {
  const safeFps = fps > 0 ? fps : DEFAULT_FPS;
  const typeFrames = Math.floor((5 / TYPE_SPEED) * safeFps); // ~5 chars worth of typing

  const elements: BrowserDemoElement[] = [
    { id: 'name-input', type: 'input', content: 'John Doe', position: { x: 20, y: 60 } },
    { id: 'email-input', type: 'input', content: 'john@example.com', position: { x: 20, y: 110 } },
    { id: 'submit-btn', type: 'button', content: 'Submit', position: { x: 20, y: 160 } },
    { id: 'success-msg', type: 'text', content: 'Form submitted successfully!', position: { x: 20, y: 220 } },
  ];

  const actions: BrowserAction[] = [
    { type: 'type', target: '#name-input', value: 'John Doe', delay: 0, duration: typeFrames },
    { type: 'type', target: '#email-input', value: 'john@example.com', delay: 5, duration: typeFrames },
    { type: 'click', target: '#submit-btn', delay: 5, duration: CLICK_DURATION_FRAMES },
    { type: 'highlight', target: '#success-msg', delay: 5, duration: Math.floor(durationFrames / 4) },
  ];

  return { elements, actions };
}

function getDashboardTemplate(durationFrames: number, fps: number): TemplateDefinition {
  const safeFps = fps > 0 ? fps : DEFAULT_FPS;
  const highlightDuration = Math.floor(durationFrames / 5);
  const scrollDuration = Math.floor((300 / SCROLL_SPEED) * safeFps);

  const elements: BrowserDemoElement[] = [
    { id: 'metric-1', type: 'metric', content: '1,234 Users', position: { x: 20, y: 60 } },
    { id: 'metric-2', type: 'metric', content: '567 Active', position: { x: 200, y: 60 } },
    { id: 'metric-3', type: 'metric', content: '89% Uptime', position: { x: 380, y: 60 } },
    { id: 'chart', type: 'chart', content: 'Revenue Chart', position: { x: 20, y: 200 } },
  ];

  const actions: BrowserAction[] = [
    { type: 'highlight', target: '#metric-1', delay: 0, duration: highlightDuration },
    { type: 'highlight', target: '#metric-2', delay: 5, duration: highlightDuration },
    { type: 'highlight', target: '#metric-3', delay: 5, duration: highlightDuration },
    { type: 'scroll', value: '300', delay: 5, duration: scrollDuration },
  ];

  return { elements, actions };
}

// ── Template Generator Map ─────────────────────────────────────────────────────

type TemplateGenerator = (durationFrames: number, fps: number) => TemplateDefinition;

const TEMPLATE_GENERATORS: Record<Exclude<BrowserTemplateId, 'custom'>, TemplateGenerator> = {
  'api-request': getApiRequestTemplate,
  'form-submit': getFormSubmitTemplate,
  'dashboard': getDashboardTemplate,
};

// ── Action Scheduling ──────────────────────────────────────────────────────────

export function computeActionTimeline(actions: BrowserAction[]): TimelineEntry[] {
  const timeline: TimelineEntry[] = [];
  let currentFrame = 0;

  for (const action of actions) {
    const startFrame = currentFrame + action.delay;
    const endFrame = startFrame + action.duration;
    timeline.push({ action, startFrame, endFrame });
    currentFrame = endFrame;
  }

  return timeline;
}

export function getActiveAction(
  timeline: TimelineEntry[],
  currentFrame: number,
): ActiveActionState | null {
  for (const entry of timeline) {
    if (currentFrame >= entry.startFrame && currentFrame < entry.endFrame) {
      const duration = entry.endFrame - entry.startFrame;
      const progress = duration > 0
        ? Math.min(1, Math.max(0, (currentFrame - entry.startFrame) / duration))
        : 1;
      return { entry, progress };
    }
  }
  return null;
}

export function interpolateActionState(
  action: BrowserAction,
  progress: number,
): InterpolatedState {
  const state: InterpolatedState = { scrollY: 0 };

  switch (action.type) {
    case 'click': {
      // Parse target for position hint (default center of viewport)
      const x = 200;
      const y = 100;
      state.cursor = {
        x,
        y,
        visible: true,
        clicking: progress > 0.3 && progress < 0.7,
      };
      break;
    }
    case 'type': {
      const text = action.value ?? '';
      const charCount = Math.floor(progress * text.length);
      if (action.target) {
        state.typedChars = { target: action.target, count: charCount };
      }
      state.cursor = {
        x: 100,
        y: 80,
        visible: true,
        clicking: false,
      };
      break;
    }
    case 'scroll': {
      const targetScroll = parseFloat(action.value ?? '0');
      state.scrollY = Math.round(progress * targetScroll);
      break;
    }
    case 'highlight': {
      // Fade in/out based on progress
      let opacity: number;
      if (progress < HIGHLIGHT_FADE_FRACTION) {
        opacity = progress / HIGHLIGHT_FADE_FRACTION; // fade in
      } else if (progress > 1 - HIGHLIGHT_FADE_FRACTION) {
        opacity = (1 - progress) / HIGHLIGHT_FADE_FRACTION; // fade out
      } else {
        opacity = 1;
      }
      if (action.target) {
        state.activeHighlight = {
          target: action.target,
          opacity: Math.max(0, Math.min(1, opacity)),
        };
      }
      break;
    }
    case 'wait':
      // No visual changes during wait
      break;
  }

  return state;
}

// ── Main Function ──────────────────────────────────────────────────────────────

export function generateBrowserDemoProps(
  config: BrowserBRollConfig,
  durationFrames: number,
  currentFrame: number = 0,
  fps: number = 30,
): BrowserDemoProps {
  const safeFps = fps > 0 ? fps : DEFAULT_FPS;
  const safeFrame = Math.max(0, currentFrame);

  // Resolve template
  let templateElements: BrowserDemoElement[] = [];
  let resolvedActions: BrowserAction[];

  if (config.templateId !== 'custom' && config.templateId in TEMPLATE_GENERATORS) {
    const generator = TEMPLATE_GENERATORS[config.templateId as Exclude<BrowserTemplateId, 'custom'>];
    const template = generator(durationFrames, safeFps);
    templateElements = template.elements;
    // Merge: template actions first, then config actions
    resolvedActions = [...template.actions, ...config.actions];
  } else {
    // Custom template: pass-through user-defined actions, no template content
    resolvedActions = config.actions;
  }

  // Compute action timeline and active state
  const timeline = computeActionTimeline(resolvedActions);
  const activeState = getActiveAction(timeline, safeFrame);

  // Build content
  let content: BrowserDemoContent | null;

  if (templateElements.length === 0 && !activeState) {
    content = null;
  } else {
    const interpolated = activeState
      ? interpolateActionState(activeState.entry.action, activeState.progress)
      : { scrollY: 0 };

    // Apply typed chars to elements
    const elements = templateElements.map((el) => {
      if (interpolated.typedChars && `#${el.id}` === interpolated.typedChars.target) {
        return { ...el, visibleChars: interpolated.typedChars.count };
      }
      return el;
    });

    // Resolve cursor position from target element when available
    let resolvedCursor = interpolated.cursor;
    if (resolvedCursor && activeState?.entry.action.target && templateElements.length > 0) {
      const targetId = activeState.entry.action.target.replace(/^#/, '');
      const targetEl = templateElements.find((el) => el.id === targetId);
      if (targetEl) {
        resolvedCursor = { ...resolvedCursor, x: targetEl.position.x, y: targetEl.position.y };
      }
    }

    content = {
      elements,
      cursor: resolvedCursor,
      scrollY: interpolated.scrollY,
      activeHighlight: interpolated.activeHighlight,
    };
  }

  return {
    url: config.url,
    content,
    actions: resolvedActions,
    viewport: config.viewport,
    style: { theme: 'light' },
  };
}
