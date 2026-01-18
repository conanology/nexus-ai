import {
  StageInput, StageOutput, ArtifactRef,
  executeStage,
  logger, CloudStorageClient,
  createProviderRegistry, getAllProviders,
  getThumbnailPath,
  withRetry, withFallback,
  NexusError
} from '@nexus-ai/core';
import { ThumbnailInput, ThumbnailOutput, ThumbnailVariant } from './types.js';
import { THUMBNAIL_VARIANTS } from './prompts.js';

/**
 * Execute Thumbnail generation stage
 * 
 * Generates 3 A/B variants (Bold, Visual, Mixed) for a given topic and visual concept.
 * Follows NFR22 (3 variants) and ensures all images are uploaded to Cloud Storage.
 */
export async function executeThumbnail(
  input: StageInput<ThumbnailInput>
): Promise<StageOutput<ThumbnailOutput>> {
  return executeStage(input, 'thumbnail', async (data, config) => {
    const { pipelineId } = input;
    const { topic, visualConcept } = data;
    const storage = new CloudStorageClient();
    const registry = createProviderRegistry();
    const imageProviders = getAllProviders(registry.image);

    const variantConfigs = [
      { type: 'bold' as const, prompt: THUMBNAIL_VARIANTS.bold.generatePrompt(topic) },
      { type: 'visual' as const, prompt: THUMBNAIL_VARIANTS.visual.generatePrompt(visualConcept) },
      { type: 'mixed' as const, prompt: THUMBNAIL_VARIANTS.mixed.generatePrompt(topic, visualConcept) }
    ];

    let usedProvider = 'unknown';
    let worstTier: 'primary' | 'fallback' = 'primary';

    // Generate variants in parallel
    const variantResults = await Promise.all(
      variantConfigs.map(async (variantConfig, index) => {
        const variantNum = index + 1;
        
        const retryResult = await withRetry(
          () => withFallback(
            imageProviders,
            async (provider) => {
              const result = await provider.generate(variantConfig.prompt, {
                width: 1280,
                height: 720,
                count: 1
              });
              return result;
            },
            { stage: 'thumbnail' }
          ),
          { maxRetries: config.retries || 3, stage: 'thumbnail' }
        );

        const fallbackResult = retryResult.result;
        const imageResult = fallbackResult.result;
        const currentProvider = fallbackResult.provider;
        const tier = fallbackResult.tier;

        usedProvider = currentProvider;
        if (tier === 'fallback') worstTier = 'fallback';
        
        const sourceUrl = imageResult.imageUrls[0];
        if (!sourceUrl) {
          throw NexusError.critical(
            'NEXUS_THUMBNAIL_NO_IMAGE',
            `Provider ${currentProvider} returned no image URL for variant ${variantConfig.type}`,
            'thumbnail'
          );
        }

        const targetPath = getThumbnailPath(pipelineId, variantNum);
        let finalUrl = sourceUrl;

        const isTargetGsUri = sourceUrl.startsWith('gs://') && sourceUrl.includes(targetPath);
        
        if (!isTargetGsUri) {
          logger.debug({ sourceUrl, targetPath }, 'Relocating thumbnail to contract path');
          if (sourceUrl.startsWith('http')) {
            const response = await fetch(sourceUrl);
            if (!response.ok) {
              throw NexusError.critical(
                'NEXUS_THUMBNAIL_FETCH_ERROR',
                `Failed to fetch image from ${sourceUrl}`,
                'thumbnail',
                { status: response.status }
              );
            }
            const buffer = Buffer.from(await response.arrayBuffer());
            finalUrl = await storage.uploadFile(targetPath, buffer, 'image/png');
          } else if (sourceUrl.startsWith('gs://')) {
            const buffer = await storage.downloadFile(sourceUrl);
            finalUrl = await storage.uploadFile(targetPath, buffer, 'image/png');
          }
        }

        const storagePath = finalUrl.replace(/^gs:\/\/[^\/]+\//, '');
        
        const variant: ThumbnailVariant = {
          type: variantConfig.type,
          url: storage.getPublicUrl(storagePath),
          prompt: variantConfig.prompt
        };

        const artifact: ArtifactRef = {
          type: 'image',
          url: finalUrl,
          size: 0, 
          contentType: 'image/png',
          generatedAt: imageResult.generatedAt || new Date().toISOString(),
          stage: 'thumbnail'
        };

        return { variant, artifact, attempts: retryResult.attempts, cost: imageResult.cost, provider: currentProvider };
      })
    );

    const variants = variantResults.map(r => r.variant);
    const artifacts = variantResults.map(r => r.artifact);
    const totalCost = variantResults.reduce((sum, r) => sum + r.cost, 0);
    const totalAttempts = variantResults.reduce((sum, r) => sum + r.attempts, 0);

    if (config.tracker && typeof (config.tracker as any).recordApiCall === 'function') {
      (config.tracker as any).recordApiCall(usedProvider, { input: 0, output: 0 }, totalCost);
    }

    return {
      variants,
      artifacts,
      provider: {
        name: usedProvider,
        tier: worstTier,
        attempts: totalAttempts
      }
    } as any;
  }, { qualityGate: 'thumbnail' });
}
