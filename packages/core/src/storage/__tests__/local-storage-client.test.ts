import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalStorageClient } from '../local-storage-client.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('LocalStorageClient', () => {
  let client: LocalStorageClient;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-local-storage-test-'));
    client = new LocalStorageClient(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('uploadFile', () => {
    it('creates file at correct path', async () => {
      const content = Buffer.from('hello world');
      const result = await client.uploadFile('2026-01-08/tts/audio.wav', content, 'audio/wav');

      expect(result).toBe('local://2026-01-08/tts/audio.wav');

      const filePath = path.join(tmpDir, '2026-01-08', 'tts', 'audio.wav');
      const written = await fs.readFile(filePath);
      expect(written.toString()).toBe('hello world');
    });

    it('creates nested directories automatically', async () => {
      const content = Buffer.from('test');
      await client.uploadFile('a/b/c/d/file.txt', content, 'text/plain');

      const filePath = path.join(tmpDir, 'a', 'b', 'c', 'd', 'file.txt');
      const written = await fs.readFile(filePath);
      expect(written.toString()).toBe('test');
    });

    it('handles string content', async () => {
      const result = await client.uploadFile('test.json', '{"key":"value"}', 'application/json');
      expect(result).toBe('local://test.json');

      const filePath = path.join(tmpDir, 'test.json');
      const written = await fs.readFile(filePath, 'utf-8');
      expect(written).toBe('{"key":"value"}');
    });
  });

  describe('downloadFile', () => {
    it('reads file from correct path', async () => {
      // Setup: write a file first
      const content = Buffer.from('download test');
      await client.uploadFile('test/file.txt', content, 'text/plain');

      const downloaded = await client.downloadFile('test/file.txt');
      expect(downloaded.toString()).toBe('download test');
    });

    it('throws on missing file', async () => {
      await expect(client.downloadFile('nonexistent.txt')).rejects.toThrow();
    });

    it('handles gs:// prefixed paths', async () => {
      await client.uploadFile('2026-01-08/tts/audio.wav', Buffer.from('audio'), 'audio/wav');
      const downloaded = await client.downloadFile('gs://some-bucket/2026-01-08/tts/audio.wav');
      expect(downloaded.toString()).toBe('audio');
    });
  });

  describe('fileExists', () => {
    it('returns true for existing files', async () => {
      await client.uploadFile('exists.txt', Buffer.from('yes'), 'text/plain');
      expect(await client.fileExists('exists.txt')).toBe(true);
    });

    it('returns false for missing files', async () => {
      expect(await client.fileExists('missing.txt')).toBe(false);
    });
  });

  describe('deleteFile', () => {
    it('removes file from storage', async () => {
      await client.uploadFile('delete-me.txt', Buffer.from('bye'), 'text/plain');
      expect(await client.fileExists('delete-me.txt')).toBe(true);

      await client.deleteFile('delete-me.txt');
      expect(await client.fileExists('delete-me.txt')).toBe(false);
    });
  });

  describe('listFiles', () => {
    it('returns files under prefix', async () => {
      await client.uploadFile('2026-01-08/tts/audio.wav', Buffer.from('a'), 'audio/wav');
      await client.uploadFile('2026-01-08/tts/segment-0.wav', Buffer.from('b'), 'audio/wav');
      await client.uploadFile('2026-01-08/visual-gen/scenes.json', Buffer.from('c'), 'application/json');

      const ttsFiles = await client.listFiles('2026-01-08/tts');
      expect(ttsFiles).toHaveLength(2);
      expect(ttsFiles).toContain('2026-01-08/tts/audio.wav');
      expect(ttsFiles).toContain('2026-01-08/tts/segment-0.wav');
    });

    it('returns empty array for missing prefix', async () => {
      const files = await client.listFiles('nonexistent/prefix');
      expect(files).toHaveLength(0);
    });
  });

  describe('uploadArtifact / downloadArtifact', () => {
    it('builds correct path from date/stage/filename', async () => {
      const content = Buffer.from('artifact data');
      const url = await client.uploadArtifact('2026-01-08', 'tts', 'audio.wav', content, 'audio/wav');
      expect(url).toBe('local://2026-01-08/tts/audio.wav');

      const downloaded = await client.downloadArtifact('2026-01-08', 'tts', 'audio.wav');
      expect(downloaded.toString()).toBe('artifact data');
    });
  });

  describe('getPublicUrl', () => {
    it('returns file:// URL', () => {
      const url = client.getPublicUrl('2026-01-08/render/video.mp4');
      expect(url).toContain('file://');
      expect(url).toContain('2026-01-08/render/video.mp4');
    });
  });

  describe('getGsUri', () => {
    it('returns local:// URI', () => {
      const uri = client.getGsUri('2026-01-08/render/video.mp4');
      expect(uri).toBe('local://2026-01-08/render/video.mp4');
    });
  });

  describe('getSignedUrl', () => {
    it('returns file:// URL by default', async () => {
      const url = await client.getSignedUrl('test/file.txt');
      expect(url).toContain('file://');
    });

    it('returns http://localhost URL when port is set', async () => {
      client.setHttpPort(8888);
      const url = await client.getSignedUrl('test/file.txt');
      expect(url).toBe('http://localhost:8888/test/file.txt');
    });
  });

  describe('getAbsolutePath', () => {
    it('resolves to absolute path under base', () => {
      const abs = client.getAbsolutePath('2026-01-08/tts/audio.wav');
      expect(path.isAbsolute(abs)).toBe(true);
      expect(abs).toContain('2026-01-08');
    });
  });
});
