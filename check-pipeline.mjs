import { Firestore } from '@google-cloud/firestore';

process.env.GOOGLE_APPLICATION_CREDENTIALS = '/home/acona/nexus-ai-runtime-key.json';

const db = new Firestore({
  projectId: 'nexus-ai-conan-01',
  databaseId: 'nexus-db'
});

async function checkPipeline() {
  const pipelineId = '2026-01-29';

  // Check main pipeline document
  const docRef = db.collection('pipelines').doc(pipelineId);
  const doc = await docRef.get();

  if (doc.exists) {
    const data = doc.data();
    console.log(`Pipeline ${pipelineId} exists!`);
    console.log(`Status: ${data.status}`);
    console.log(`Current Stage: ${data.currentStage}`);
    console.log(`Started: ${data.startedAt}`);

    // Check state subdocument
    const stateDoc = await db.collection('pipelines').doc(`${pipelineId}_state`).get();
    if (stateDoc.exists) {
      console.log('\nState document exists:');
      const state = stateDoc.data();
      for (const [key, value] of Object.entries(state)) {
        console.log(`  ${key}: ${value?.status || 'N/A'}`);
      }
    }
  } else {
    console.log(`Pipeline ${pipelineId} does NOT exist in Firestore!`);
  }

  // List recent pipelines
  console.log('\n\nRecent pipelines:');
  const pipelines = await db.collection('pipelines')
    .orderBy('startedAt', 'desc')
    .limit(5)
    .get();

  pipelines.forEach(p => {
    const data = p.data();
    console.log(`  ${p.id}: ${data.status} - ${data.currentStage} - ${data.startedAt}`);
  });
}

checkPipeline().catch(console.error);
