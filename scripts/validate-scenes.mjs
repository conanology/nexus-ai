import fs from 'fs';
const d = JSON.parse(fs.readFileSync('D:/05_Work/NEXUS-AI-PROJECT/local-storage/claude-s-c-compiler-vs-gcc/scenes-enriched.json', 'utf8'));
const issues = [];
d.scenes.forEach((s, i) => {
  if (s.id === undefined) issues.push(`scene ${i}: missing id`);
  if (s.type === undefined) issues.push(`scene ${i}: missing type`);
  if (typeof s.startFrame !== 'number') issues.push(`scene ${i}: bad startFrame`);
  if (typeof s.endFrame !== 'number') issues.push(`scene ${i}: bad endFrame`);
  if (typeof s.content !== 'string') issues.push(`scene ${i}: bad content type=${typeof s.content}`);
  if (s.visualData === null || s.visualData === undefined) issues.push(`scene ${i}: missing visualData`);
  if (!['cut','fade'].includes(s.transition)) issues.push(`scene ${i}: bad transition=${s.transition}`);
  // Check for data URIs that should have been materialized
  if (s.backgroundImage && s.backgroundImage.startsWith('data:')) issues.push(`scene ${i}: still has data URI backgroundImage`);
});
if (issues.length === 0) {
  console.log('All ' + d.scenes.length + ' scenes pass validation');
} else {
  issues.forEach(x => console.log(x));
}
console.log('\nTotal duration frames:', d.totalDurationFrames);
console.log('Scene count:', d.scenes.length);
