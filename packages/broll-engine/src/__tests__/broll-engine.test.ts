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
      const result = generateCodeSnippetProps(sampleCodeConfig, 300);

      expect(result.code).toBe('const x = 42;');
      expect(result.language).toBe('typescript');
      expect(result.visibleChars).toBe(sampleCodeConfig.content.length);
      expect(result.highlightLines).toEqual([1]);
      expect(result.showCursor).toBe(false);
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

      const result = generateCodeSnippetProps(configNoHighlight, 150);

      expect(result.highlightLines).toEqual([]);
    });

    it('sets visibleChars to full content length', () => {
      const result = generateCodeSnippetProps(sampleCodeConfig, 300);

      expect(result.visibleChars).toBe(13); // 'const x = 42;'.length
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
      // These type assertions verify the types are properly exported.
      // If any type is missing from exports, this file will not compile.
      const _spec: BRollSpec | undefined = undefined;
      const _input: BRollEngineInput | undefined = undefined;
      const _output: BRollEngineOutput | undefined = undefined;
      const _style: BrowserStyle | undefined = undefined;
      const _codeProps: CodeSnippetProps | undefined = undefined;
      const _browserProps: BrowserDemoProps | undefined = undefined;

      // Suppress unused variable warnings
      expect(_spec).toBeUndefined();
      expect(_input).toBeUndefined();
      expect(_output).toBeUndefined();
      expect(_style).toBeUndefined();
      expect(_codeProps).toBeUndefined();
      expect(_browserProps).toBeUndefined();
    });
  });
});
