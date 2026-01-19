/**
 * Unit tests for Twitter package
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatTweetText, postTweet } from '../twitter.js';
import type { TwitterStageInput } from '../types.js';

describe('formatTweetText', () => {
  it('should format tweet with title, URL, and hashtags', () => {
    const title = 'Amazing AI Breakthrough';
    const videoUrl = 'https://youtube.com/watch?v=abc123';
    
    const result = formatTweetText(title, videoUrl);
    
    expect(result).toContain(title);
    expect(result).toContain(videoUrl);
    expect(result).toContain('🎬');
    expect(result).toContain('#AI');
    expect(result).toContain('#MachineLearning');
    expect(result).toContain('Watch now:');
  });

  it('should format tweet exactly as specified', () => {
    const title = 'Test Video';
    const videoUrl = 'https://youtube.com/watch?v=test';
    
    const result = formatTweetText(title, videoUrl);
    const expected = `Test Video 🎬\n\nWatch now: https://youtube.com/watch?v=test\n\n#AI #MachineLearning`;
    
    expect(result).toBe(expected);
  });

  it('should keep tweet under 280 characters', () => {
    const longTitle = 'A'.repeat(300);
    const videoUrl = 'https://youtube.com/watch?v=abc123';
    
    const result = formatTweetText(longTitle, videoUrl);
    
    expect(result.length).toBeLessThanOrEqual(280);
  });

  it('should truncate title with ellipsis if too long', () => {
    const longTitle = 'A'.repeat(300);
    const videoUrl = 'https://youtube.com/watch?v=abc123';
    
    const result = formatTweetText(longTitle, videoUrl);
    
    expect(result).toContain('...');
    expect(result).toContain(videoUrl);
    expect(result).toContain('#AI #MachineLearning');
  });

  it('should preserve URL and hashtags when truncating', () => {
    const longTitle = 'A'.repeat(300);
    const videoUrl = 'https://youtube.com/watch?v=verylongid12345';
    
    const result = formatTweetText(longTitle, videoUrl);
    
    // Must contain full URL
    expect(result).toContain(videoUrl);
    // Must contain both hashtags
    expect(result).toContain('#AI');
    expect(result).toContain('#MachineLearning');
    // Must be within limit
    expect(result.length).toBeLessThanOrEqual(280);
  });

  it('should handle special characters in title', () => {
    const title = 'Test & "Special" <Characters>';
    const videoUrl = 'https://youtube.com/watch?v=abc';
    
    const result = formatTweetText(title, videoUrl);
    
    expect(result).toContain(title);
    expect(result.length).toBeLessThanOrEqual(280);
  });

  it('should handle emoji in title', () => {
    const title = 'AI Revolution 🚀🤖';
    const videoUrl = 'https://youtube.com/watch?v=abc';
    
    const result = formatTweetText(title, videoUrl);
    
    expect(result).toContain(title);
    expect(result.length).toBeLessThanOrEqual(280);
  });

  it('should handle newlines and whitespace in title', () => {
    const title = 'Title   with\n\nextra  whitespace';
    const videoUrl = 'https://youtube.com/watch?v=abc';
    
    const result = formatTweetText(title, videoUrl);
    
    expect(result.length).toBeLessThanOrEqual(280);
  });

  it('should count emoji correctly (2 chars for 🎬)', () => {
    // Tweet format: "{title} 🎬\n\nWatch now: {url}\n\n#AI #MachineLearning"
    // Fixed parts: " 🎬\n\nWatch now: \n\n#AI #MachineLearning" = 2 + 2 + 12 + 2 + 19 = 37
    // URL is around 43 chars
    // Total fixed = ~80 chars
    // Title can be ~200 chars
    const title = 'A'.repeat(200);
    const videoUrl = 'https://youtube.com/watch?v=abc123';
    
    const result = formatTweetText(title, videoUrl);
    
    expect(result.length).toBeLessThanOrEqual(280);
  });

  it('should handle minimum length title', () => {
    const title = 'A';
    const videoUrl = 'https://youtube.com/watch?v=abc';
    
    const result = formatTweetText(title, videoUrl);
    
    expect(result).toContain(title);
    expect(result).toContain(videoUrl);
    expect(result.length).toBeLessThanOrEqual(280);
  });

  it('should handle empty title gracefully', () => {
    const title = '';
    const videoUrl = 'https://youtube.com/watch?v=abc';
    
    const result = formatTweetText(title, videoUrl);
    
    expect(result).toContain(videoUrl);
    expect(result.length).toBeLessThanOrEqual(280);
  });
});

describe('postTweet', () => {
  it('should exist and be callable', () => {
    expect(postTweet).toBeDefined();
    expect(typeof postTweet).toBe('function');
  });

  // Mock tests will be in integration test file
});
