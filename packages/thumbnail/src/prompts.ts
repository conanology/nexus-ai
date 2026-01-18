export const COMMON_KEYWORDS = "YouTube thumbnail, 4k, highly detailed, catchy";

export const THUMBNAIL_VARIANTS = {
  bold: {
    name: 'Bold',
    description: 'Focus on large, high-contrast text',
    generatePrompt: (topic: string) => 
      `${COMMON_KEYWORDS}. Focus on large, high-contrast text of the title: "${topic}". Bold typography, clean background.`
  },
  visual: {
    name: 'Visual',
    description: 'Focus on illustration with minimal text',
    generatePrompt: (visualConcept: string) => 
      `${COMMON_KEYWORDS}. Focus on the visual concept: ${visualConcept}. Minimal text, vibrant colors, expressive imagery.`
  },
  mixed: {
    name: 'Mixed',
    description: 'Balanced composition of text and visual',
    generatePrompt: (topic: string, visualConcept: string) => 
      `${COMMON_KEYWORDS}. Balanced composition. Text title: "${topic}". Visual element: ${visualConcept}. Professional layout.`
  }
};
