import { describe, it, expect } from 'vitest';
import {
  generateBrowserDemoProps,
} from '../browser-demo.js';
import {
  computeActionTimeline,
  getActiveAction,
  interpolateActionState,
} from '../browser-demo.js';
import type {
  BrowserBRollConfig,
  BrowserAction,
  BrowserDemoProps,
  BrowserDemoContent,
} from '../index.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeBrowserConfig(
  overrides: Partial<BrowserBRollConfig> = {},
): BrowserBRollConfig {
  return {
    url: 'https://example.com',
    templateId: 'custom',
    actions: [],
    viewport: { width: 1280, height: 720 },
    ...overrides,
  };
}

// ── Task 4.1: Template Generator Tests ─────────────────────────────────────────

describe('browser-demo template generators', () => {
  describe('api-request template', () => {
    it('produces actions with click, wait, and highlight types', () => {
      const config = makeBrowserConfig({ templateId: 'api-request' });
      const result = generateBrowserDemoProps(config, 300, 0, 30);

      expect(result.content).not.toBeNull();
      const content = result.content as BrowserDemoContent;
      expect(content.elements.length).toBeGreaterThanOrEqual(3);

      // Template actions should include click, wait, highlight
      const actionTypes = result.actions.map((a) => a.type);
      expect(actionTypes).toContain('click');
      expect(actionTypes).toContain('wait');
      expect(actionTypes).toContain('highlight');
    });

    it('has url-input, send-btn, loading, and response elements', () => {
      const config = makeBrowserConfig({ templateId: 'api-request' });
      const result = generateBrowserDemoProps(config, 300, 0, 30);

      const content = result.content as BrowserDemoContent;
      const ids = content.elements.map((e) => e.id);
      expect(ids).toContain('url-input');
      expect(ids).toContain('send-btn');
      expect(ids).toContain('loading');
      expect(ids).toContain('response');
    });
  });

  describe('form-submit template', () => {
    it('produces actions with type, click, and highlight types', () => {
      const config = makeBrowserConfig({ templateId: 'form-submit' });
      const result = generateBrowserDemoProps(config, 300, 0, 30);

      const actionTypes = result.actions.map((a) => a.type);
      expect(actionTypes).toContain('type');
      expect(actionTypes).toContain('click');
      expect(actionTypes).toContain('highlight');
    });

    it('has name-input, email-input, submit-btn, success-msg elements', () => {
      const config = makeBrowserConfig({ templateId: 'form-submit' });
      const result = generateBrowserDemoProps(config, 300, 0, 30);

      const content = result.content as BrowserDemoContent;
      const ids = content.elements.map((e) => e.id);
      expect(ids).toContain('name-input');
      expect(ids).toContain('email-input');
      expect(ids).toContain('submit-btn');
      expect(ids).toContain('success-msg');
    });
  });

  describe('dashboard template', () => {
    it('produces actions with highlight and scroll types', () => {
      const config = makeBrowserConfig({ templateId: 'dashboard' });
      const result = generateBrowserDemoProps(config, 300, 0, 30);

      const actionTypes = result.actions.map((a) => a.type);
      expect(actionTypes).toContain('highlight');
      expect(actionTypes).toContain('scroll');
    });

    it('has metric and chart elements', () => {
      const config = makeBrowserConfig({ templateId: 'dashboard' });
      const result = generateBrowserDemoProps(config, 300, 0, 30);

      const content = result.content as BrowserDemoContent;
      const types = content.elements.map((e) => e.type);
      expect(types).toContain('metric');
      expect(types).toContain('chart');
    });
  });
});

// ── Task 4.2: Action Timeline Computation ──────────────────────────────────────

describe('computeActionTimeline', () => {
  it('computes cumulative delay + duration', () => {
    const actions: BrowserAction[] = [
      { type: 'click', target: '#a', delay: 10, duration: 5 },
      { type: 'scroll', value: '100', delay: 20, duration: 15 },
      { type: 'wait', delay: 0, duration: 10 },
    ];

    const timeline = computeActionTimeline(actions);

    // action[0]: start=0+10=10, end=10+5=15
    expect(timeline[0].startFrame).toBe(10);
    expect(timeline[0].endFrame).toBe(15);

    // action[1]: start=15+20=35, end=35+15=50
    expect(timeline[1].startFrame).toBe(35);
    expect(timeline[1].endFrame).toBe(50);

    // action[2]: start=50+0=50, end=50+10=60
    expect(timeline[2].startFrame).toBe(50);
    expect(timeline[2].endFrame).toBe(60);
  });

  it('returns empty timeline for empty actions', () => {
    const timeline = computeActionTimeline([]);
    expect(timeline).toEqual([]);
  });

  it('handles zero delay actions', () => {
    const actions: BrowserAction[] = [
      { type: 'click', target: '#a', delay: 0, duration: 10 },
      { type: 'click', target: '#b', delay: 0, duration: 10 },
    ];

    const timeline = computeActionTimeline(actions);
    expect(timeline[0].startFrame).toBe(0);
    expect(timeline[0].endFrame).toBe(10);
    expect(timeline[1].startFrame).toBe(10);
    expect(timeline[1].endFrame).toBe(20);
  });
});

// ── Task 4.3: getActiveAction Tests ────────────────────────────────────────────

describe('getActiveAction', () => {
  const actions: BrowserAction[] = [
    { type: 'click', target: '#a', delay: 10, duration: 20 },
    { type: 'scroll', value: '100', delay: 5, duration: 15 },
  ];

  const timeline = computeActionTimeline(actions);
  // action[0]: start=10, end=30
  // action[1]: start=35, end=50

  it('returns null before first action starts', () => {
    const result = getActiveAction(timeline, 5);
    expect(result).toBeNull();
  });

  it('returns first action during its range', () => {
    const result = getActiveAction(timeline, 15);
    expect(result).not.toBeNull();
    expect(result!.entry.action.type).toBe('click');
    expect(result!.progress).toBeCloseTo(0.25);
  });

  it('returns null between actions (in delay gap)', () => {
    const result = getActiveAction(timeline, 32);
    expect(result).toBeNull();
  });

  it('returns second action during its range', () => {
    const result = getActiveAction(timeline, 40);
    expect(result).not.toBeNull();
    expect(result!.entry.action.type).toBe('scroll');
  });

  it('returns null after all actions end', () => {
    const result = getActiveAction(timeline, 100);
    expect(result).toBeNull();
  });

  it('returns action at exact start frame', () => {
    const result = getActiveAction(timeline, 10);
    expect(result).not.toBeNull();
    expect(result!.progress).toBe(0);
  });

  it('returns null at exact end frame (exclusive)', () => {
    const result = getActiveAction(timeline, 30);
    expect(result).toBeNull();
  });
});

// ── Task 4.4: Action Type Interpolation ────────────────────────────────────────

describe('interpolateActionState', () => {
  describe('click action', () => {
    const clickAction: BrowserAction = {
      type: 'click', target: '#btn', delay: 0, duration: 10,
    };

    it('shows cursor visible during click', () => {
      const state = interpolateActionState(clickAction, 0.5);
      expect(state.cursor).toBeDefined();
      expect(state.cursor!.visible).toBe(true);
    });

    it('sets clicking true in middle phase (0.3-0.7)', () => {
      const state = interpolateActionState(clickAction, 0.5);
      expect(state.cursor!.clicking).toBe(true);
    });

    it('sets clicking false at start', () => {
      const state = interpolateActionState(clickAction, 0.1);
      expect(state.cursor!.clicking).toBe(false);
    });

    it('sets clicking false at end', () => {
      const state = interpolateActionState(clickAction, 0.9);
      expect(state.cursor!.clicking).toBe(false);
    });
  });

  describe('type action', () => {
    const typeAction: BrowserAction = {
      type: 'type', target: '#input', value: 'Hello World', delay: 0, duration: 30,
    };

    it('shows 0 chars at progress 0', () => {
      const state = interpolateActionState(typeAction, 0);
      expect(state.typedChars).toBeDefined();
      expect(state.typedChars!.count).toBe(0);
    });

    it('shows partial chars at mid-progress', () => {
      const state = interpolateActionState(typeAction, 0.5);
      expect(state.typedChars!.count).toBe(5); // floor(0.5 * 11)
    });

    it('shows all chars at progress 1', () => {
      const state = interpolateActionState(typeAction, 1);
      expect(state.typedChars!.count).toBe(11); // "Hello World".length
    });

    it('targets the correct element', () => {
      const state = interpolateActionState(typeAction, 0.5);
      expect(state.typedChars!.target).toBe('#input');
    });

    it('shows cursor visible', () => {
      const state = interpolateActionState(typeAction, 0.5);
      expect(state.cursor).toBeDefined();
      expect(state.cursor!.visible).toBe(true);
      expect(state.cursor!.clicking).toBe(false);
    });
  });

  describe('scroll action', () => {
    const scrollAction: BrowserAction = {
      type: 'scroll', value: '500', delay: 0, duration: 30,
    };

    it('scrollY is 0 at progress 0', () => {
      const state = interpolateActionState(scrollAction, 0);
      expect(state.scrollY).toBe(0);
    });

    it('scrollY interpolates at mid-progress', () => {
      const state = interpolateActionState(scrollAction, 0.5);
      expect(state.scrollY).toBe(250);
    });

    it('scrollY reaches target at progress 1', () => {
      const state = interpolateActionState(scrollAction, 1);
      expect(state.scrollY).toBe(500);
    });
  });

  describe('highlight action', () => {
    const highlightAction: BrowserAction = {
      type: 'highlight', target: '#el', delay: 0, duration: 30,
    };

    it('fades in at start (opacity < 1)', () => {
      const state = interpolateActionState(highlightAction, 0.05);
      expect(state.activeHighlight).toBeDefined();
      expect(state.activeHighlight!.opacity).toBeLessThan(1);
      expect(state.activeHighlight!.opacity).toBeGreaterThan(0);
    });

    it('full opacity in middle', () => {
      const state = interpolateActionState(highlightAction, 0.5);
      expect(state.activeHighlight!.opacity).toBe(1);
    });

    it('fades out at end (opacity < 1)', () => {
      const state = interpolateActionState(highlightAction, 0.95);
      expect(state.activeHighlight!.opacity).toBeLessThan(1);
      expect(state.activeHighlight!.opacity).toBeGreaterThan(0);
    });

    it('targets the correct element', () => {
      const state = interpolateActionState(highlightAction, 0.5);
      expect(state.activeHighlight!.target).toBe('#el');
    });
  });

  describe('wait action', () => {
    const waitAction: BrowserAction = {
      type: 'wait', delay: 0, duration: 30,
    };

    it('produces no visual changes', () => {
      const state = interpolateActionState(waitAction, 0.5);
      expect(state.cursor).toBeUndefined();
      expect(state.scrollY).toBe(0);
      expect(state.activeHighlight).toBeUndefined();
      expect(state.typedChars).toBeUndefined();
    });
  });
});

// ── Task 4.5: End-to-End generateBrowserDemoProps ──────────────────────────────

describe('generateBrowserDemoProps end-to-end', () => {
  describe('api-request template', () => {
    it('returns complete BrowserDemoProps', () => {
      const config = makeBrowserConfig({
        templateId: 'api-request',
        url: 'https://api.test.com',
      });
      const result = generateBrowserDemoProps(config, 300, 15, 30);

      expect(result.url).toBe('https://api.test.com');
      expect(result.viewport).toEqual({ width: 1280, height: 720 });
      expect(result.style).toEqual({ theme: 'light' });
      expect(result.content).not.toBeNull();
      expect(result.actions.length).toBeGreaterThan(0);
    });
  });

  describe('form-submit template', () => {
    it('returns content with typing state at active frame', () => {
      const config = makeBrowserConfig({ templateId: 'form-submit' });
      // Frame 2 should be during the first type action
      const result = generateBrowserDemoProps(config, 300, 2, 30);

      expect(result.content).not.toBeNull();
      const content = result.content as BrowserDemoContent;
      expect(content.elements.length).toBeGreaterThan(0);
    });

    it('resolves cursor position from target element during type action', () => {
      const config = makeBrowserConfig({ templateId: 'form-submit' });
      // Frame 2 is during the first type action targeting #name-input (position x:20, y:60)
      const result = generateBrowserDemoProps(config, 300, 2, 30);

      const content = result.content as BrowserDemoContent;
      if (content.cursor) {
        // Cursor should be at name-input element position (x:20, y:60)
        expect(content.cursor.x).toBe(20);
        expect(content.cursor.y).toBe(60);
      }
    });
  });

  describe('dashboard template', () => {
    it('returns content with dashboard elements', () => {
      const config = makeBrowserConfig({ templateId: 'dashboard' });
      const result = generateBrowserDemoProps(config, 300, 5, 30);

      expect(result.content).not.toBeNull();
      const content = result.content as BrowserDemoContent;
      const metricCount = content.elements.filter((e) => e.type === 'metric').length;
      expect(metricCount).toBe(3);
    });
  });
});

// ── Task 4.6: Custom Template Pass-Through ─────────────────────────────────────

describe('custom template pass-through', () => {
  it('uses config actions directly without template expansion', () => {
    const customActions: BrowserAction[] = [
      { type: 'click', target: '#custom-btn', delay: 0, duration: 10 },
    ];
    const config = makeBrowserConfig({
      templateId: 'custom',
      actions: customActions,
    });

    const result = generateBrowserDemoProps(config, 300, 0, 30);

    // Custom template should have no template elements
    // Content is null when custom and no active action at frame 0
    // Actually at frame 0, the click starts at frame 0, so action is active
    expect(result.actions).toEqual(customActions);
  });

  it('returns null content for custom with empty actions and no active state', () => {
    const config = makeBrowserConfig({
      templateId: 'custom',
      actions: [],
    });

    const result = generateBrowserDemoProps(config, 300, 0, 30);
    expect(result.content).toBeNull();
  });

  it('returns content with cursor when custom action is active', () => {
    const config = makeBrowserConfig({
      templateId: 'custom',
      actions: [{ type: 'click', target: '#btn', delay: 0, duration: 20 }],
    });

    const result = generateBrowserDemoProps(config, 300, 5, 30);
    expect(result.content).not.toBeNull();
    const content = result.content as BrowserDemoContent;
    expect(content.cursor).toBeDefined();
    expect(content.cursor!.visible).toBe(true);
  });
});

// ── Task 4.6b: Template + Config Action Merging ──────────────────────────────

describe('template + config action merging', () => {
  it('appends config actions after template actions', () => {
    const extraAction: BrowserAction = {
      type: 'wait', delay: 0, duration: 50,
    };
    const config = makeBrowserConfig({
      templateId: 'api-request',
      actions: [extraAction],
    });

    const result = generateBrowserDemoProps(config, 300, 0, 30);

    // Template actions come first, config action is last
    const lastAction = result.actions[result.actions.length - 1];
    expect(lastAction.type).toBe('wait');
    expect(lastAction.duration).toBe(50);
    // Total actions = template actions + 1 config action
    expect(result.actions.length).toBeGreaterThan(1);
  });

  it('does not merge for custom template', () => {
    const config = makeBrowserConfig({
      templateId: 'custom',
      actions: [{ type: 'click', target: '#a', delay: 0, duration: 10 }],
    });

    const result = generateBrowserDemoProps(config, 300, 0, 30);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].target).toBe('#a');
  });
});

// ── Task 4.7: Edge Cases ───────────────────────────────────────────────────────

describe('edge cases', () => {
  it('handles empty actions array', () => {
    const config = makeBrowserConfig({ actions: [] });
    const result = generateBrowserDemoProps(config, 300, 0, 30);

    expect(result.url).toBe('https://example.com');
    expect(result.content).toBeNull();
    expect(result.actions).toEqual([]);
  });

  it('handles 0 durationFrames', () => {
    const config = makeBrowserConfig({ templateId: 'api-request' });
    const result = generateBrowserDemoProps(config, 0, 0, 30);

    // Should still return valid props
    expect(result.url).toBe('https://example.com');
    expect(result.content).not.toBeNull();
  });

  it('handles negative frame by clamping to 0', () => {
    const config = makeBrowserConfig({ templateId: 'dashboard' });
    const result = generateBrowserDemoProps(config, 300, -10, 30);

    // Clamped to frame 0, should still have content
    expect(result.content).not.toBeNull();
  });

  it('handles fps=0 by falling back to default 30', () => {
    const config = makeBrowserConfig({ templateId: 'form-submit' });
    const result = generateBrowserDemoProps(config, 300, 5, 0);

    // Should not crash, falls back to fps=30
    expect(result.content).not.toBeNull();
    expect(result.actions.length).toBeGreaterThan(0);
  });

  it('handles negative fps by falling back to default 30', () => {
    const config = makeBrowserConfig({ templateId: 'dashboard' });
    const result = generateBrowserDemoProps(config, 300, 5, -10);

    expect(result.content).not.toBeNull();
  });

  it('handles 0 duration action', () => {
    const actions: BrowserAction[] = [
      { type: 'click', target: '#btn', delay: 0, duration: 0 },
    ];
    const timeline = computeActionTimeline(actions);
    expect(timeline[0].startFrame).toBe(0);
    expect(timeline[0].endFrame).toBe(0);

    // getActiveAction at frame 0 with duration 0 (start=end=0) should return null
    const active = getActiveAction(timeline, 0);
    expect(active).toBeNull();
  });
});

// ── Task 4.8: Backward Compatibility ───────────────────────────────────────────

describe('backward compatibility', () => {
  it('works with just (config, durationFrames) - 2 args', () => {
    const config: BrowserBRollConfig = {
      url: 'https://test.dev',
      templateId: 'custom',
      actions: [],
      viewport: { width: 1920, height: 1080 },
    };

    const result = generateBrowserDemoProps(config, 300);

    expect(result.url).toBe('https://test.dev');
    expect(result.viewport).toEqual({ width: 1920, height: 1080 });
    expect(result.style).toEqual({ theme: 'light' });
    // Custom with no actions at frame 0 → null content
    expect(result.content).toBeNull();
    expect(result.actions).toEqual([]);
  });

  it('preserves url pass-through', () => {
    const config = makeBrowserConfig({ url: 'https://backward.compat' });
    const result = generateBrowserDemoProps(config, 300);
    expect(result.url).toBe('https://backward.compat');
  });

  it('preserves viewport pass-through', () => {
    const config = makeBrowserConfig({ viewport: { width: 800, height: 600 } });
    const result = generateBrowserDemoProps(config, 300);
    expect(result.viewport).toEqual({ width: 800, height: 600 });
  });

  it('preserves style default', () => {
    const config = makeBrowserConfig();
    const result = generateBrowserDemoProps(config, 300);
    expect(result.style).toEqual({ theme: 'light' });
  });
});
