/**
 * Generate placeholder thumbnail templates
 * Run with: node scripts/generate-templates.mjs
 */

import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../..');

// Template configurations matching the 3 variants
const templates = [
  {
    name: 'variant-1-bold.png',
    description: 'Bold Text style',
    background: { r: 13, g: 71, b: 161 }, // Deep blue
  },
  {
    name: 'variant-2-visual.png',
    description: 'Visual Focus style',
    background: { r: 244, g: 67, b: 54 }, // Vibrant red
  },
  {
    name: 'variant-3-mixed.png',
    description: 'Mixed style',
    background: { r: 76, g: 175, b: 80 }, // Green
  },
];

async function generateTemplates() {
  const outputDir = join(projectRoot, 'data', 'templates', 'thumbnails');

  // Ensure directory exists
  await mkdir(outputDir, { recursive: true });

  console.log('Generating placeholder thumbnail templates...\n');

  for (const template of templates) {
    const outputPath = join(outputDir, template.name);

    // Create 1280x720 solid color background
    const svg = `
      <svg width="1280" height="720">
        <rect width="1280" height="720" fill="rgb(${template.background.r}, ${template.background.g}, ${template.background.b})" />
      </svg>
    `;

    await sharp(Buffer.from(svg))
      .png()
      .toFile(outputPath);

    console.log(`✓ Created: ${template.name} (${template.description})`);
  }

  console.log('\n✓ All template thumbnails generated successfully!');
  console.log(`  Location: ${outputDir}`);
}

generateTemplates().catch((error) => {
  console.error('Error generating templates:', error);
  process.exit(1);
});
