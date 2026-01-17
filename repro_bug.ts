
import { chunkScript } from './packages/tts/src/chunker.js';

console.log('Testing self-closing tag handling...');
const script = 'Hello <break time="500ms"/> world. Next sentence.';
// Force small chunk to ensure it processes tags but maybe doesn't split exactly on the tag if not needed, 
// but we want to see if preserveSSMLTags messes up a single chunk.
const chunks = chunkScript(script, 100);

chunks.forEach(c => {
    console.log(`Chunk ${c.index}: ${c.text}`);
});

if (chunks[0].text.includes('</break>')) {
    console.log('FAIL: Added closing tag to self-closing tag');
} else {
    console.log('PASS: Handled self-closing tag correctly');
}

if (chunks.length > 1 && chunks[1].text.includes('<break')) {
     console.log('FAIL: Duplicated self-closing tag in next chunk');
}
