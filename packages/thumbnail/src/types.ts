import { StageInput, StageOutput } from '@nexus-ai/core';

export interface ThumbnailInput {
  topic: string;
  visualConcept: string;
}

export interface ThumbnailVariant {
  type: 'bold' | 'visual' | 'mixed';
  url: string;
  prompt: string;
}

export interface ThumbnailOutput {
  variants: ThumbnailVariant[];
  selectedVariant?: ThumbnailVariant; // Optional, if one is picked later
}

export type ThumbnailStageInput = StageInput<ThumbnailInput>;
export type ThumbnailStageOutput = StageOutput<ThumbnailOutput>;
