import { describe, it, expect } from 'vitest';
import {
  generateCodeSnippetProps,
  generateBrowserDemoProps,
} from '../index.js';
import type {
  CodeBRollConfig,
  BrowserBRollConfig,
  CodeSnippetProps,
  BrowserDemoProps,
  BRollSpec,
  BRollEngineInput,
  BRollEngineOutput,
  BrowserStyle,
} from '../index.js';

describe('broll-engine', () => {
  describe('generateCodeSnippetProps', () => {
    const sampleCodeConfig: CodeBRollConfig = {
      content: 'const x = 42;',
      language: 'typescript',
      highlightLines: [1],
      typingEffect: true,
      typingSpeed: 50,
      theme: 'dark',
      showLineNumbers: true,
    };

    it('returns valid CodeSnippetProps with correct pass-through values', () => {
      // Call with all chars visible (currentFrame high enough to show all)
      const result = generateCodeSnippetProps(sampleCodeConfig, 300, 300, 30);

      expect(result.code).toBe('const x = 42;');
      expect(result.language).toBe('typescript');
      expect(result.highlightLines).toEqual([1]);
      expect(result.theme).toBe('dark');
      expect(result.showLineNumbers).toBe(true);
    });

    it('defaults highlightLines to empty array when not provided', () => {
      const configNoHighlight: CodeBRollConfig = {
        content: 'hello()',
        language: 'javascript',
        typingEffect: false,
        typingSpeed: 0,
        theme: 'light',
        showLineNumbers: false,
      };

      const result = generateCodeSnippetProps(configNoHighlight, 150, 0, 30);

      expect(result.highlightLines).toEqual([]);
    });

    describe('progressive typing (AC1, AC2)', () => {
      it('shows 0 visibleChars at frame 0', () => {
        const result = generateCodeSnippetProps(sampleCodeConfig, 300, 0, 30);
        expect(result.visibleChars).toBe(0);
      });

      it('shows all chars at final frame when enough time has elapsed', () => {
        // With typingSpeed=50 and fps=30, charsPerFrame = 50/30 ≈ 1.67
        // To show 13 chars: frame = ceil(13 / 1.67) = 8
        // At frame 300 (well past needed), all chars should show
        const result = generateCodeSnippetProps(sampleCodeConfig, 300, 300, 30);
        expect(result.visibleChars).toBe(sampleCodeConfig.content.length);
      });

      it('progressively reveals characters based on frame', () => {
        // typingSpeed=50, fps=30 → charsPerFrame = 50/30 ≈ 1.667
        // frame=3 → floor(3 * 1.667) = floor(5.0) = 5
        const result = generateCodeSnippetProps(sampleCodeConfig, 300, 3, 30);
        expect(result.visibleChars).toBe(5);
      });

      it('clamps visibleChars to code.length', () => {
        // Even at a very high frame, visibleChars should not exceed code length
        const result = generateCodeSnippetProps(sampleCodeConfig, 300, 9999, 30);
        expect(result.visibleChars).toBe(sampleCodeConfig.content.length);
      });

      it('clamps visibleChars to 0 minimum', () => {
        const result = generateCodeSnippetProps(sampleCodeConfig, 300, 0, 30);
        expect(result.visibleChars).toBe(0);
      });
    });

    describe('typing speed configuration (AC2)', () => {
      it('uses custom typingSpeed from config', () => {
        const config: CodeBRollConfig = {
          content: 'console.log("hello");',
          language: 'javascript',
          typingEffect: true,
          typingSpeed: 60,
          theme: 'dark',
          showLineNumbers: true,
        };

        // typingSpeed=60, fps=30 → charsPerFrame = 2
        // frame=5 → floor(5 * 2) = 10
        const result = generateCodeSnippetProps(config, 300, 5, 30);
        expect(result.visibleChars).toBe(10);
      });

      it('uses default 30 chars/sec when typingSpeed is 0', () => {
        const config: CodeBRollConfig = {
          content: 'const a = 1;',
          language: 'typescript',
          typingEffect: true,
          typingSpeed: 0,
          theme: 'dark',
          showLineNumbers: true,
        };

        // typingSpeed defaults to 30, fps=30 → charsPerFrame = 1
        // frame=5 → floor(5 * 1) = 5
        const result = generateCodeSnippetProps(config, 300, 5, 30);
        expect(result.visibleChars).toBe(5);
      });

      it('higher speed shows more chars at same frame', () => {
        const slowConfig: CodeBRollConfig = {
          content: 'abcdefghijklmnopqrstuvwxyz',
          language: 'text',
          typingEffect: true,
          typingSpeed: 30,
          theme: 'dark',
          showLineNumbers: false,
        };

        const fastConfig: CodeBRollConfig = {
          ...slowConfig,
          typingSpeed: 60,
        };

        const slowResult = generateCodeSnippetProps(slowConfig, 300, 10, 30);
        const fastResult = generateCodeSnippetProps(fastConfig, 300, 10, 30);

        expect(fastResult.visibleChars).toBeGreaterThan(slowResult.visibleChars);
      });
    });

    describe('line highlighting sequencing (AC3)', () => {
      const multiLineConfig: CodeBRollConfig = {
        content: 'line1\nline2\nline3\nline4',
        language: 'text',
        highlightLines: [1, 2, 3, 4],
        typingEffect: true,
        typingSpeed: 30,
        theme: 'dark',
        showLineNumbers: true,
      };

      it('highlights only visible lines', () => {
        // typingSpeed=30, fps=30 → charsPerFrame = 1
        // frame=3 → 3 chars visible → "lin" → 1 line visible
        const result = generateCodeSnippetProps(multiLineConfig, 300, 3, 30);
        expect(result.highlightLines).toEqual([1]);
      });

      it('highlights more lines as typing progresses', () => {
        // frame=8 → 8 chars → "line1\nli" → 2 lines visible
        const result = generateCodeSnippetProps(multiLineConfig, 300, 8, 30);
        expect(result.highlightLines).toEqual([1, 2]);
      });

      it('highlights all lines when all text is typed', () => {
        const result = generateCodeSnippetProps(multiLineConfig, 300, 300, 30);
        expect(result.highlightLines).toEqual([1, 2, 3, 4]);
      });

      it('returns empty highlight array when none configured', () => {
        const noHighlightConfig: CodeBRollConfig = {
          content: 'line1\nline2',
          language: 'text',
          typingEffect: true,
          typingSpeed: 30,
          theme: 'dark',
          showLineNumbers: false,
        };

        const result = generateCodeSnippetProps(noHighlightConfig, 300, 300, 30);
        expect(result.highlightLines).toEqual([]);
      });

      it('returns empty highlight array at frame 0', () => {
        const result = generateCodeSnippetProps(multiLineConfig, 300, 0, 30);
        expect(result.highlightLines).toEqual([]);
      });
    });

    describe('cursor behavior (AC4)', () => {
      it('shows cursor while typing is in progress', () => {
        // frame=1, some chars visible but not all
        const result = generateCodeSnippetProps(sampleCodeConfig, 300, 1, 30);
        expect(result.visibleChars).toBeLessThan(sampleCodeConfig.content.length);
        expect(result.showCursor).toBe(true);
      });

      it('blinks cursor when typing is complete', () => {
        // At frame 300, all typed. Blink depends on frame modulo.
        // frame=300 → floor(300/15) = 20 → 20 % 2 = 0 → cursor ON
        const resultOn = generateCodeSnippetProps(sampleCodeConfig, 300, 300, 30);
        expect(resultOn.visibleChars).toBe(sampleCodeConfig.content.length);
        expect(resultOn.showCursor).toBe(true); // 300/15=20, even → on

        // frame=315 → floor(315/15) = 21 → 21 % 2 = 1 → cursor OFF
        const resultOff = generateCodeSnippetProps(sampleCodeConfig, 300, 315, 30);
        expect(resultOff.showCursor).toBe(false);
      });

      it('cursor alternates when all text typed', () => {
        // Test a few frames to verify alternation
        const results: boolean[] = [];
        for (let frame = 300; frame < 360; frame += 15) {
          const result = generateCodeSnippetProps(sampleCodeConfig, 300, frame, 30);
          results.push(result.showCursor);
        }
        // Should alternate: true, false, true, false
        expect(results).toEqual([true, false, true, false]);
      });
    });

    describe('all CodeSnippetProps fields populated (AC5)', () => {
      it('returns all required fields', () => {
        const result = generateCodeSnippetProps(sampleCodeConfig, 300, 5, 30);

        expect(result).toHaveProperty('code');
        expect(result).toHaveProperty('language');
        expect(result).toHaveProperty('visibleChars');
        expect(result).toHaveProperty('highlightLines');
        expect(result).toHaveProperty('showCursor');
        expect(result).toHaveProperty('theme');
        expect(result).toHaveProperty('showLineNumbers');

        expect(typeof result.code).toBe('string');
        expect(typeof result.language).toBe('string');
        expect(typeof result.visibleChars).toBe('number');
        expect(Array.isArray(result.highlightLines)).toBe(true);
        expect(typeof result.showCursor).toBe('boolean');
        expect(['dark', 'light']).toContain(result.theme);
        expect(typeof result.showLineNumbers).toBe('boolean');
      });
    });

    describe('edge cases', () => {
      it('handles empty code string', () => {
        const emptyConfig: CodeBRollConfig = {
          content: '',
          language: 'text',
          typingEffect: true,
          typingSpeed: 30,
          theme: 'dark',
          showLineNumbers: false,
        };

        const result = generateCodeSnippetProps(emptyConfig, 300, 0, 30);
        expect(result.visibleChars).toBe(0);
        expect(result.code).toBe('');
        expect(result.highlightLines).toEqual([]);
        expect(result.showCursor).toBe(false);
      });

      it('handles negative currentFrame by clamping to 0', () => {
        const result = generateCodeSnippetProps(sampleCodeConfig, 300, -10, 30);
        expect(result.visibleChars).toBe(0);
        expect(result.showCursor).toBe(true);
      });

      it('handles fps=0 by falling back to default 30', () => {
        const result = generateCodeSnippetProps(sampleCodeConfig, 300, 3, 0);
        // Falls back to fps=30, typingSpeed=50 → charsPerFrame=50/30≈1.667
        // frame=3 → floor(3*1.667) = 5
        expect(result.visibleChars).toBe(5);
      });

      it('handles negative typingSpeed by falling back to default 30', () => {
        const config: CodeBRollConfig = {
          content: 'const a = 1;',
          language: 'typescript',
          typingEffect: true,
          typingSpeed: -10,
          theme: 'dark',
          showLineNumbers: true,
        };

        // Falls back to 30 chars/sec, fps=30 → charsPerFrame=1
        // frame=5 → 5 chars
        const result = generateCodeSnippetProps(config, 300, 5, 30);
        expect(result.visibleChars).toBe(5);
      });

      it('handles single character code', () => {
        const singleCharConfig: CodeBRollConfig = {
          content: 'x',
          language: 'text',
          typingEffect: true,
          typingSpeed: 30,
          theme: 'dark',
          showLineNumbers: false,
        };

        // frame=0 → 0 chars
        const result0 = generateCodeSnippetProps(singleCharConfig, 300, 0, 30);
        expect(result0.visibleChars).toBe(0);
        expect(result0.showCursor).toBe(true);

        // frame=1 → floor(1 * 1) = 1 char → all typed
        const result1 = generateCodeSnippetProps(singleCharConfig, 300, 1, 30);
        expect(result1.visibleChars).toBe(1);
      });

      it('handles very long code', () => {
        const longCode = 'a'.repeat(10000);
        const longConfig: CodeBRollConfig = {
          content: longCode,
          language: 'text',
          typingEffect: true,
          typingSpeed: 30,
          theme: 'dark',
          showLineNumbers: false,
        };

        // At frame 0, should be 0
        const result0 = generateCodeSnippetProps(longConfig, 300, 0, 30);
        expect(result0.visibleChars).toBe(0);

        // At very high frame, should cap at code length
        const resultMax = generateCodeSnippetProps(longConfig, 300, 999999, 30);
        expect(resultMax.visibleChars).toBe(10000);
      });

      it('backward compatible: works with just config and durationFrames (defaults)', () => {
        // When called with only 2 args, should default currentFrame=0 and fps=30
        const result = generateCodeSnippetProps(sampleCodeConfig, 300);
        expect(result.visibleChars).toBe(0);
        expect(result.code).toBe('const x = 42;');
        expect(result.showCursor).toBe(true);
      });
    });
  });

  describe('generateBrowserDemoProps', () => {
    const sampleBrowserConfig: BrowserBRollConfig = {
      url: 'https://example.com',
      templateId: 'dashboard',
      actions: [
        { type: 'click', target: '#btn', delay: 10, duration: 5 },
        { type: 'scroll', value: '500', delay: 20, duration: 15 },
      ],
      viewport: { width: 1280, height: 720 },
    };

    it('returns valid BrowserDemoProps with correct pass-through values', () => {
      const result = generateBrowserDemoProps(sampleBrowserConfig, 300);

      expect(result.url).toBe('https://example.com');
      expect(result.content).toBeNull();
      expect(result.actions).toEqual(sampleBrowserConfig.actions);
      expect(result.viewport).toEqual({ width: 1280, height: 720 });
      expect(result.style).toEqual({ theme: 'light' });
    });

    it('passes through viewport dimensions correctly', () => {
      const config: BrowserBRollConfig = {
        url: 'https://test.dev',
        templateId: 'custom',
        actions: [],
        viewport: { width: 1920, height: 1080 },
      };

      const result = generateBrowserDemoProps(config, 600);

      expect(result.viewport.width).toBe(1920);
      expect(result.viewport.height).toBe(1080);
    });

    it('handles actions with only required fields (no target/value)', () => {
      const config: BrowserBRollConfig = {
        url: 'https://example.com',
        templateId: 'dashboard',
        actions: [
          { type: 'wait', delay: 0, duration: 30 },
        ],
        viewport: { width: 1280, height: 720 },
      };

      const result = generateBrowserDemoProps(config, 300);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe('wait');
      expect(result.actions[0].target).toBeUndefined();
      expect(result.actions[0].value).toBeUndefined();
    });
  });

  describe('type exports', () => {
    it('exports all expected types (compile-time check)', () => {
      const _spec: BRollSpec | undefined = undefined;
      const _input: BRollEngineInput | undefined = undefined;
      const _output: BRollEngineOutput | undefined = undefined;
      const _style: BrowserStyle | undefined = undefined;
      const _codeProps: CodeSnippetProps | undefined = undefined;
      const _browserProps: BrowserDemoProps | undefined = undefined;

      expect(_spec).toBeUndefined();
      expect(_input).toBeUndefined();
      expect(_output).toBeUndefined();
      expect(_style).toBeUndefined();
      expect(_codeProps).toBeUndefined();
      expect(_browserProps).toBeUndefined();
    });
  });
});
