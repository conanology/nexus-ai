console.log('1. Starting imports...');

console.log('2. Importing express...');
import express from 'express';
console.log('3. Express imported');

console.log('4. Importing @nexus-ai/core...');
import { logger, NEXUS_VERSION } from '@nexus-ai/core';
console.log('5. Core imported');

console.log('6. Importing handlers/health...');
import { handleHealthCheck } from './src/handlers/health.js';
console.log('7. Health handler imported');

console.log('8. Importing handlers/scheduled...');
import { handleScheduledTrigger } from './src/handlers/scheduled.js';
console.log('9. Scheduled handler imported');

console.log('10. Importing handlers/manual...');
import { handleManualTrigger, handleResumeTrigger } from './src/handlers/manual.js';
console.log('11. Manual handlers imported');

console.log('12. Creating server...');
const app = express();
app.use(express.json());
app.get('/health', handleHealthCheck);
app.post('/trigger/scheduled', handleScheduledTrigger);
app.post('/trigger/manual', handleManualTrigger);
app.post('/trigger/resume', handleResumeTrigger);

const PORT = 8080;
console.log('13. Starting listen...');
app.listen(PORT, () => {
  console.log(`14. Server listening on port ${PORT}`);
});
console.log('15. Listen called');
