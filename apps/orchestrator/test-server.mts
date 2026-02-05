console.log('1. Starting imports...');
console.log('2. Importing express...');
import express from 'express';
console.log('3. Express imported');

console.log('4. Importing @nexus-ai/core...');
import { logger, NEXUS_VERSION } from '@nexus-ai/core';
console.log('5. Core imported');

console.log('6. Creating server...');
const app = express();
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = 8080;
console.log('7. Starting listen...');
app.listen(PORT, () => {
  console.log(`8. Server listening on port ${PORT}`);
});
console.log('9. Listen called (async)');
