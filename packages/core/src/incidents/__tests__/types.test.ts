/**
 * Tests for incident types
 *
 * Verifies that all incident types are properly defined and can be used
 * as expected for type-safe incident management.
 */

import { describe, it, expect } from 'vitest';
import type {
  IncidentSeverity,
  ResolutionType,
  RootCauseType,
  Incident,
  IncidentRecord,
  ResolutionDetails,
  PostMortemTemplate,
  IncidentSummary,
  IncidentDigestEntry,
  IncidentContext,
  IncidentErrorDetails,
} from '../types.js';

describe('Incident Types', () => {
  describe('IncidentSeverity', () => {
    it('should accept valid severity values', () => {
      const critical: IncidentSeverity = 'CRITICAL';
      const warning: IncidentSeverity = 'WARNING';
      const recoverable: IncidentSeverity = 'RECOVERABLE';

      expect(critical).toBe('CRITICAL');
      expect(warning).toBe('WARNING');
      expect(recoverable).toBe('RECOVERABLE');
    });
  });

  describe('ResolutionType', () => {
    it('should accept valid resolution type values', () => {
      const retry: ResolutionType = 'retry';
      const fallback: ResolutionType = 'fallback';
      const skip: ResolutionType = 'skip';
      const manual: ResolutionType = 'manual';
      const autoRecovered: ResolutionType = 'auto_recovered';

      expect(retry).toBe('retry');
      expect(fallback).toBe('fallback');
      expect(skip).toBe('skip');
      expect(manual).toBe('manual');
      expect(autoRecovered).toBe('auto_recovered');
    });
  });

  describe('RootCauseType', () => {
    it('should accept valid root cause type values', () => {
      const causes: RootCauseType[] = [
        'api_outage',
        'rate_limit',
        'quota_exceeded',
        'timeout',
        'network_error',
        'auth_failure',
        'config_error',
        'data_error',
        'resource_exhausted',
        'dependency_failure',
        'unknown',
      ];

      expect(causes).toHaveLength(11);
      causes.forEach((cause) => {
        expect(typeof cause).toBe('string');
      });
    });
  });

  describe('Incident', () => {
    it('should create a valid incident input', () => {
      const incident: Incident = {
        date: '2026-01-22',
        pipelineId: '2026-01-22',
        stage: 'tts',
        error: {
          code: 'NEXUS_TTS_TIMEOUT',
          message: 'TTS synthesis timed out after 30 seconds',
        },
        severity: 'CRITICAL',
        startTime: '2026-01-22T06:15:00.000Z',
        rootCause: 'timeout',
        context: {
          provider: 'gemini-2.5-pro-tts',
          attempt: 3,
          fallbacksUsed: ['chirp3-hd'],
        },
      };

      expect(incident.date).toBe('2026-01-22');
      expect(incident.stage).toBe('tts');
      expect(incident.severity).toBe('CRITICAL');
      expect(incident.rootCause).toBe('timeout');
      expect(incident.context.provider).toBe('gemini-2.5-pro-tts');
    });

    it('should allow optional stack trace in error', () => {
      const errorWithStack: IncidentErrorDetails = {
        code: 'NEXUS_TTS_TIMEOUT',
        message: 'TTS synthesis timed out',
        stack: 'Error: TTS synthesis timed out\n    at TTSProvider.synthesize',
      };

      expect(errorWithStack.stack).toBeDefined();
    });

    it('should allow additional context fields', () => {
      const context: IncidentContext = {
        provider: 'gemini',
        attempt: 1,
        customField: 'custom value',
        nestedObject: { nested: true },
      };

      expect(context.customField).toBe('custom value');
      expect(context.nestedObject).toEqual({ nested: true });
    });
  });

  describe('IncidentRecord', () => {
    it('should create a valid incident record with all required fields', () => {
      const record: IncidentRecord = {
        id: '2026-01-22-001',
        date: '2026-01-22',
        pipelineId: '2026-01-22',
        stage: 'tts',
        error: {
          code: 'NEXUS_TTS_TIMEOUT',
          message: 'TTS synthesis timed out',
        },
        severity: 'CRITICAL',
        startTime: '2026-01-22T06:15:00.000Z',
        rootCause: 'timeout',
        context: {},
        isOpen: true,
        createdAt: '2026-01-22T06:15:00.000Z',
        updatedAt: '2026-01-22T06:15:00.000Z',
      };

      expect(record.id).toBe('2026-01-22-001');
      expect(record.isOpen).toBe(true);
      expect(record.createdAt).toBe('2026-01-22T06:15:00.000Z');
      expect(record.endTime).toBeUndefined();
      expect(record.resolution).toBeUndefined();
    });

    it('should create a resolved incident record with duration', () => {
      const resolved: IncidentRecord = {
        id: '2026-01-22-001',
        date: '2026-01-22',
        pipelineId: '2026-01-22',
        stage: 'tts',
        error: {
          code: 'NEXUS_TTS_TIMEOUT',
          message: 'TTS synthesis timed out',
        },
        severity: 'WARNING',
        startTime: '2026-01-22T06:15:00.000Z',
        endTime: '2026-01-22T06:16:30.000Z',
        duration: 90000, // 90 seconds
        rootCause: 'timeout',
        context: {},
        isOpen: false, // Resolved incidents are closed
        resolution: {
          type: 'retry',
          notes: 'Succeeded after 2nd retry',
          resolvedBy: 'system',
        },
        createdAt: '2026-01-22T06:15:00.000Z',
        updatedAt: '2026-01-22T06:16:30.000Z',
      };

      expect(resolved.isOpen).toBe(false);
      expect(resolved.endTime).toBe('2026-01-22T06:16:30.000Z');
      expect(resolved.duration).toBe(90000);
      expect(resolved.resolution?.type).toBe('retry');
      expect(resolved.resolution?.resolvedBy).toBe('system');
    });
  });

  describe('ResolutionDetails', () => {
    it('should create minimal resolution details', () => {
      const resolution: ResolutionDetails = {
        type: 'fallback',
      };

      expect(resolution.type).toBe('fallback');
      expect(resolution.notes).toBeUndefined();
      expect(resolution.resolvedBy).toBeUndefined();
    });

    it('should create full resolution details', () => {
      const resolution: ResolutionDetails = {
        type: 'manual',
        notes: 'API key was rotated',
        resolvedBy: 'operator',
      };

      expect(resolution.type).toBe('manual');
      expect(resolution.notes).toBe('API key was rotated');
      expect(resolution.resolvedBy).toBe('operator');
    });
  });

  describe('PostMortemTemplate', () => {
    it('should create a valid post-mortem template', () => {
      const postMortem: PostMortemTemplate = {
        generatedAt: '2026-01-22T06:20:00.000Z',
        timeline: {
          detected: '2026-01-22T06:15:00.000Z',
          impact: 'Stage "tts" failed with NEXUS_TTS_TIMEOUT',
        },
        summary: 'CRITICAL incident in tts stage: TTS synthesis timed out',
        impact: {
          pipelineAffected: true,
          stageAffected: 'tts',
          potentialVideoImpact: true,
        },
        rootCauseAnalysis: '<!-- TODO: Fill in root cause analysis -->',
        actionItems: [],
        lessonsLearned: '<!-- TODO: Fill in lessons learned -->',
      };

      expect(postMortem.generatedAt).toBeDefined();
      expect(postMortem.timeline.detected).toBeDefined();
      expect(postMortem.impact.pipelineAffected).toBe(true);
      expect(postMortem.actionItems).toHaveLength(0);
    });

    it('should allow resolved timeline', () => {
      const postMortem: PostMortemTemplate = {
        generatedAt: '2026-01-22T06:20:00.000Z',
        timeline: {
          detected: '2026-01-22T06:15:00.000Z',
          impact: 'Stage "tts" failed',
          resolved: '2026-01-22T06:30:00.000Z',
        },
        summary: 'CRITICAL incident resolved',
        impact: {
          pipelineAffected: true,
          stageAffected: 'tts',
          potentialVideoImpact: true,
        },
        rootCauseAnalysis: 'External API outage caused timeout',
        actionItems: ['Add circuit breaker', 'Increase timeout'],
        lessonsLearned: 'Need better monitoring for external APIs',
      };

      expect(postMortem.timeline.resolved).toBeDefined();
      expect(postMortem.actionItems).toHaveLength(2);
    });
  });

  describe('IncidentSummary', () => {
    it('should create a valid incident summary for digest', () => {
      const summary: IncidentSummary = {
        date: '2026-01-22',
        totalCount: 3,
        criticalCount: 1,
        warningCount: 1,
        recoverableCount: 1,
        stagesAffected: ['tts', 'research'],
        avgResolutionTimeMs: 45000,
        openIncidents: 1,
        incidents: [
          {
            id: '2026-01-22-001',
            stage: 'tts',
            severity: 'CRITICAL',
            error: 'TTS synthesis timed out',
          },
          {
            id: '2026-01-22-002',
            stage: 'research',
            severity: 'WARNING',
            error: 'Rate limit exceeded',
            resolution: 'retry',
            duration: 45000,
          },
        ],
      };

      expect(summary.totalCount).toBe(3);
      expect(summary.criticalCount).toBe(1);
      expect(summary.stagesAffected).toContain('tts');
      expect(summary.avgResolutionTimeMs).toBe(45000);
      expect(summary.incidents).toHaveLength(2);
    });

    it('should handle empty summary', () => {
      const emptySummary: IncidentSummary = {
        date: '2026-01-22',
        totalCount: 0,
        criticalCount: 0,
        warningCount: 0,
        recoverableCount: 0,
        stagesAffected: [],
        avgResolutionTimeMs: null,
        openIncidents: 0,
        incidents: [],
      };

      expect(emptySummary.totalCount).toBe(0);
      expect(emptySummary.avgResolutionTimeMs).toBeNull();
      expect(emptySummary.incidents).toHaveLength(0);
    });
  });

  describe('IncidentDigestEntry', () => {
    it('should create an open incident entry', () => {
      const entry: IncidentDigestEntry = {
        id: '2026-01-22-001',
        stage: 'tts',
        severity: 'CRITICAL',
        error: 'TTS synthesis timed out',
      };

      expect(entry.resolution).toBeUndefined();
      expect(entry.duration).toBeUndefined();
    });

    it('should create a resolved incident entry', () => {
      const entry: IncidentDigestEntry = {
        id: '2026-01-22-002',
        stage: 'research',
        severity: 'RECOVERABLE',
        error: 'Rate limit exceeded',
        resolution: 'retry',
        duration: 15000,
      };

      expect(entry.resolution).toBe('retry');
      expect(entry.duration).toBe(15000);
    });
  });
});
