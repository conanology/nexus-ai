// Pipeline state management with Firestore persistence

import { FirestoreClient, NexusError } from '@nexus-ai/core';

export interface StageStatus {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: string;
  endTime?: string;
  durationMs?: number;
  provider?: {
    name: string;
    tier: 'primary' | 'fallback';
    attempts: number;
  };
  cost?: any;
  error?: {
    code: string;
    message: string;
    severity: string;
  };
  retryAttempts?: number;
}

export interface PipelineState {
  pipelineId: string;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'skipped';
  currentStage: string | null;
  startTime: string;
  endTime?: string;
  stages: Record<string, StageStatus>;
  qualityContext: {
    degradedStages: string[];
    fallbacksUsed: string[];
    flags: string[];
  };
}

export class PipelineStateManager {
  private firestore: FirestoreClient;

  constructor() {
    this.firestore = new FirestoreClient();
  }

  async initializePipeline(pipelineId: string): Promise<void> {
    const initialState: PipelineState = {
      pipelineId,
      status: 'running',
      currentStage: null,
      startTime: new Date().toISOString(),
      stages: {},
      qualityContext: {
        degradedStages: [],
        fallbacksUsed: [],
        flags: [],
      },
    };

    // Use Firestore path: pipelines/{pipelineId}/state
    await this.firestore.setDocument(
      `pipelines/${pipelineId}`,
      'state',
      initialState
    );
  }

  async updateStageStatus(
    pipelineId: string,
    stage: string,
    status: StageStatus
  ): Promise<void> {
    // Update specific stage status in state document
    await this.firestore.updateDocument(`pipelines/${pipelineId}`, 'state', {
      [`stages.${stage}`]: status,
      currentStage: stage,
    });
  }

  async getState(pipelineId: string): Promise<PipelineState> {
    const state = await this.firestore.getDocument<PipelineState>(
      `pipelines/${pipelineId}`,
      'state'
    );

    if (!state) {
      throw NexusError.critical(
        'NEXUS_STATE_NOT_FOUND',
        `Pipeline state not found: ${pipelineId}`,
        'orchestrator'
      );
    }

    return state;
  }

  async markComplete(pipelineId: string): Promise<void> {
    await this.firestore.updateDocument(`pipelines/${pipelineId}`, 'state', {
      status: 'completed',
      endTime: new Date().toISOString(),
    });
  }

  async markFailed(pipelineId: string, error: NexusError): Promise<void> {
    await this.firestore.updateDocument(`pipelines/${pipelineId}`, 'state', {
      status: 'failed',
      endTime: new Date().toISOString(),
      error: {
        code: error.code || 'UNKNOWN',
        message: error.message,
        severity: error.severity || 'CRITICAL',
      },
    });
  }

  async updateQualityContext(
    pipelineId: string,
    qualityContext: {
      degradedStages: string[];
      fallbacksUsed: string[];
      flags: string[];
    }
  ): Promise<void> {
    await this.firestore.updateDocument(`pipelines/${pipelineId}`, 'state', {
      qualityContext,
    });
  }

  async updateRetryAttempts(
    pipelineId: string,
    stageName: string,
    retryAttempts: number
  ): Promise<void> {
    await this.firestore.updateDocument(`pipelines/${pipelineId}`, 'state', {
      [`stages.${stageName}.retryAttempts`]: retryAttempts,
    });
  }

  async persistStageOutput(
    pipelineId: string,
    stageName: string,
    outputData: unknown
  ): Promise<void> {
    // Store stage output data for resume capability
    await this.firestore.setDocument(
      `pipelines/${pipelineId}`,
      `outputs/${stageName}`,
      { data: outputData, timestamp: new Date().toISOString() }
    );
  }

  async loadStageOutput(pipelineId: string, stageName: string): Promise<unknown> {
    const output = await this.firestore.getDocument<{ data: unknown }>(
      `pipelines/${pipelineId}`,
      `outputs/${stageName}`
    );
    return output?.data || {};
  }

  async updateTotalCost(pipelineId: string, totalCost: number): Promise<void> {
    await this.firestore.setDocument(
      `pipelines/${pipelineId}`,
      'costs',
      { 
        total: totalCost,
        timestamp: new Date().toISOString(),
      }
    );
  }
}
