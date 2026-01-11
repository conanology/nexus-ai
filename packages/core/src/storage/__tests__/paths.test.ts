/**
 * Tests for path helper functions
 */

import { describe, it, expect } from 'vitest';
import {
  // Firestore paths
  getPipelineDocPath,
  getPipelineStatePath,
  getPipelineArtifactsPath,
  getPipelineCostsPath,
  getPipelineQualityPath,
  getPipelineYouTubePath,
  getPronunciationPath,
  getTopicPath,
  getBufferVideoPath,
  getIncidentPath,
  getReviewQueuePath,
  // Cloud Storage paths
  buildStoragePath,
  parseStoragePath,
  isValidDateFormat,
  STORAGE_STAGES,
  // Convenience helpers
  getResearchPath,
  getScriptPath,
  getScriptDraftPath,
  getAudioPath,
  getAudioSegmentPath,
  getScenesPath,
  getThumbnailPath,
  getVideoPath,
} from '../paths.js';

describe('Firestore Document Paths', () => {
  describe('getPipelineDocPath', () => {
    it('should build pipeline subdocument path', () => {
      expect(getPipelineDocPath('2026-01-08', 'state')).toBe('pipelines/2026-01-08/state');
      expect(getPipelineDocPath('2026-01-08', 'artifacts')).toBe('pipelines/2026-01-08/artifacts');
    });
  });

  describe('getPipelineStatePath', () => {
    it('should build state document path', () => {
      expect(getPipelineStatePath('2026-01-08')).toBe('pipelines/2026-01-08/state');
    });
  });

  describe('getPipelineArtifactsPath', () => {
    it('should build artifacts document path', () => {
      expect(getPipelineArtifactsPath('2026-01-08')).toBe('pipelines/2026-01-08/artifacts');
    });
  });

  describe('getPipelineCostsPath', () => {
    it('should build costs document path', () => {
      expect(getPipelineCostsPath('2026-01-08')).toBe('pipelines/2026-01-08/costs');
    });
  });

  describe('getPipelineQualityPath', () => {
    it('should build quality document path', () => {
      expect(getPipelineQualityPath('2026-01-08')).toBe('pipelines/2026-01-08/quality');
    });
  });

  describe('getPipelineYouTubePath', () => {
    it('should build youtube document path', () => {
      expect(getPipelineYouTubePath('2026-01-08')).toBe('pipelines/2026-01-08/youtube');
    });
  });

  describe('getPronunciationPath', () => {
    it('should build pronunciation document path', () => {
      expect(getPronunciationPath('kubernetes')).toBe('pronunciation/kubernetes');
      expect(getPronunciationPath('PyTorch')).toBe('pronunciation/PyTorch');
    });
  });

  describe('getTopicPath', () => {
    it('should build topic document path', () => {
      expect(getTopicPath('2026-01-08')).toBe('topics/2026-01-08');
    });
  });

  describe('getBufferVideoPath', () => {
    it('should build buffer video document path', () => {
      expect(getBufferVideoPath('video-123')).toBe('buffer-videos/video-123');
    });
  });

  describe('getIncidentPath', () => {
    it('should build incident document path', () => {
      expect(getIncidentPath('incident-456')).toBe('incidents/incident-456');
    });
  });

  describe('getReviewQueuePath', () => {
    it('should build review queue document path', () => {
      expect(getReviewQueuePath('review-789')).toBe('review-queue/review-789');
    });
  });
});

describe('Cloud Storage Paths', () => {
  describe('STORAGE_STAGES', () => {
    it('should include all valid stages', () => {
      expect(STORAGE_STAGES).toContain('research');
      expect(STORAGE_STAGES).toContain('script-drafts');
      expect(STORAGE_STAGES).toContain('tts');
      expect(STORAGE_STAGES).toContain('audio-segments');
      expect(STORAGE_STAGES).toContain('visual-gen');
      expect(STORAGE_STAGES).toContain('thumbnails');
      expect(STORAGE_STAGES).toContain('render');
      expect(STORAGE_STAGES.length).toBe(7);
    });
  });

  describe('buildStoragePath', () => {
    it('should build storage path with date, stage, and filename', () => {
      expect(buildStoragePath('2026-01-08', 'research', 'research.md')).toBe(
        '2026-01-08/research/research.md'
      );
    });

    it('should handle different stages', () => {
      expect(buildStoragePath('2026-01-08', 'tts', 'audio.wav')).toBe(
        '2026-01-08/tts/audio.wav'
      );
      expect(buildStoragePath('2026-01-08', 'render', 'video.mp4')).toBe(
        '2026-01-08/render/video.mp4'
      );
    });

    it('should handle filenames with subdirectories', () => {
      expect(buildStoragePath('2026-01-08', 'thumbnails', 'variants/1.png')).toBe(
        '2026-01-08/thumbnails/variants/1.png'
      );
    });
  });

  describe('parseStoragePath', () => {
    it('should parse valid storage path', () => {
      const parsed = parseStoragePath('2026-01-08/research/research.md');
      expect(parsed.date).toBe('2026-01-08');
      expect(parsed.stage).toBe('research');
      expect(parsed.filename).toBe('research.md');
    });

    it('should handle filenames with slashes', () => {
      const parsed = parseStoragePath('2026-01-08/thumbnails/variants/1.png');
      expect(parsed.date).toBe('2026-01-08');
      expect(parsed.stage).toBe('thumbnails');
      expect(parsed.filename).toBe('variants/1.png');
    });

    it('should throw for invalid path format (too few parts)', () => {
      expect(() => parseStoragePath('2026-01-08')).toThrow('Invalid storage path format');
      expect(() => parseStoragePath('2026-01-08/research')).toThrow('Invalid storage path format');
    });

    it('should throw for invalid stage', () => {
      expect(() => parseStoragePath('2026-01-08/invalid-stage/file.txt')).toThrow(
        'Invalid storage stage: invalid-stage'
      );
    });

    it('should throw for invalid date format', () => {
      expect(() => parseStoragePath('invalid-date/research/file.txt')).toThrow(
        'Invalid date format: invalid-date'
      );
      expect(() => parseStoragePath('2026/research/file.txt')).toThrow(
        'Invalid date format'
      );
      expect(() => parseStoragePath('01-08-2026/research/file.txt')).toThrow(
        'Invalid date format'
      );
    });

    it('should allow skipping date validation', () => {
      // With validateDate=false, should not throw for invalid date
      const result = parseStoragePath('custom-folder/research/file.txt', false);
      expect(result.date).toBe('custom-folder');
      expect(result.stage).toBe('research');
      expect(result.filename).toBe('file.txt');
    });
  });

  describe('isValidDateFormat', () => {
    it('should return true for valid YYYY-MM-DD format', () => {
      expect(isValidDateFormat('2026-01-08')).toBe(true);
      expect(isValidDateFormat('2024-12-31')).toBe(true);
      expect(isValidDateFormat('1999-01-01')).toBe(true);
    });

    it('should return false for invalid formats', () => {
      expect(isValidDateFormat('2026')).toBe(false);
      expect(isValidDateFormat('2026-01')).toBe(false);
      expect(isValidDateFormat('01-08-2026')).toBe(false);
      expect(isValidDateFormat('2026/01/08')).toBe(false);
      expect(isValidDateFormat('invalid')).toBe(false);
      expect(isValidDateFormat('')).toBe(false);
    });
  });
});

describe('Convenience Storage Path Helpers', () => {
  describe('getResearchPath', () => {
    it('should build research file path', () => {
      expect(getResearchPath('2026-01-08')).toBe('2026-01-08/research/research.md');
    });
  });

  describe('getScriptPath', () => {
    it('should build script file path', () => {
      expect(getScriptPath('2026-01-08')).toBe('2026-01-08/research/script.md');
    });
  });

  describe('getScriptDraftPath', () => {
    it('should build script draft file path', () => {
      expect(getScriptDraftPath('2026-01-08', 'v1-writer')).toBe(
        '2026-01-08/script-drafts/v1-writer.md'
      );
      expect(getScriptDraftPath('2026-01-08', 'v2-critic')).toBe(
        '2026-01-08/script-drafts/v2-critic.md'
      );
      expect(getScriptDraftPath('2026-01-08', 'v3-optimizer')).toBe(
        '2026-01-08/script-drafts/v3-optimizer.md'
      );
    });
  });

  describe('getAudioPath', () => {
    it('should build audio file path', () => {
      expect(getAudioPath('2026-01-08')).toBe('2026-01-08/tts/audio.wav');
    });
  });

  describe('getAudioSegmentPath', () => {
    it('should build audio segment file path', () => {
      expect(getAudioSegmentPath('2026-01-08', 0)).toBe('2026-01-08/audio-segments/0.wav');
      expect(getAudioSegmentPath('2026-01-08', 5)).toBe('2026-01-08/audio-segments/5.wav');
    });
  });

  describe('getScenesPath', () => {
    it('should build scenes file path', () => {
      expect(getScenesPath('2026-01-08')).toBe('2026-01-08/visual-gen/scenes.json');
    });
  });

  describe('getThumbnailPath', () => {
    it('should build thumbnail file path', () => {
      expect(getThumbnailPath('2026-01-08', 1)).toBe('2026-01-08/thumbnails/1.png');
      expect(getThumbnailPath('2026-01-08', 2)).toBe('2026-01-08/thumbnails/2.png');
      expect(getThumbnailPath('2026-01-08', 3)).toBe('2026-01-08/thumbnails/3.png');
    });
  });

  describe('getVideoPath', () => {
    it('should build video file path', () => {
      expect(getVideoPath('2026-01-08')).toBe('2026-01-08/render/video.mp4');
    });
  });
});

describe('Path Consistency', () => {
  it('should have consistent date format across all paths', () => {
    const date = '2026-01-08';

    // All pipeline paths should use the same date format
    expect(getPipelineStatePath(date)).toContain(date);
    expect(getPipelineArtifactsPath(date)).toContain(date);
    expect(getPipelineCostsPath(date)).toContain(date);
    expect(getPipelineQualityPath(date)).toContain(date);
    expect(getPipelineYouTubePath(date)).toContain(date);
    expect(getTopicPath(date)).toContain(date);

    // All storage paths should use the same date format
    expect(getResearchPath(date)).toContain(date);
    expect(getScriptPath(date)).toContain(date);
    expect(getAudioPath(date)).toContain(date);
    expect(getVideoPath(date)).toContain(date);
  });

  it('should follow architecture path conventions', () => {
    // Firestore: pipelines/{YYYY-MM-DD}/state
    expect(getPipelineStatePath('2026-01-08')).toMatch(
      /^pipelines\/\d{4}-\d{2}-\d{2}\/state$/
    );

    // Firestore: pronunciation/{term}
    expect(getPronunciationPath('test')).toMatch(/^pronunciation\/\w+$/);

    // GCS: {date}/{stage}/{file}
    expect(buildStoragePath('2026-01-08', 'tts', 'audio.wav')).toMatch(
      /^\d{4}-\d{2}-\d{2}\/tts\/[\w.]+$/
    );
  });
});
