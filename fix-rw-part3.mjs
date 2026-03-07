import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import { customPapers } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  const db = drizzle(process.env.DATABASE_URL);
  const papers = await db.select().from(customPapers).where(eq(customPapers.title, 'G1 English Proficiency Test'));
  const paper = papers[0];
  const sections = JSON.parse(paper.sectionsJson);
  
  // Find rw-part3
  const rwPart3 = sections.find(s => s.id === 'rw-part3');
  if (!rwPart3) {
    console.log('rw-part3 not found!');
    process.exit(1);
  }
  
  console.log('=== BEFORE ===');
  for (const q of rwPart3.questions) {
    console.log(`Q${q.id}: question="${q.question}" correctAnswer="${q.correctAnswer}"`);
  }
  
  // Remove [Image: xxx] patterns from question text
  const imagePattern = /\s*\[Image:\s*[^\]]*\]\s*/g;
  let changed = false;
  for (const q of rwPart3.questions) {
    if (q.question && imagePattern.test(q.question)) {
      q.question = q.question.replace(imagePattern, ' ').trim();
      changed = true;
    }
    // Reset regex lastIndex
    imagePattern.lastIndex = 0;
  }
  
  // Also check section title and instructions
  if (rwPart3.instructions && imagePattern.test(rwPart3.instructions)) {
    rwPart3.instructions = rwPart3.instructions.replace(imagePattern, ' ').trim();
    changed = true;
  }
  imagePattern.lastIndex = 0;
  
  console.log('\n=== AFTER ===');
  for (const q of rwPart3.questions) {
    console.log(`Q${q.id}: question="${q.question}" correctAnswer="${q.correctAnswer}"`);
  }
  
  if (changed) {
    // Update database
    await db.update(customPapers)
      .set({ sectionsJson: JSON.stringify(sections) })
      .where(eq(customPapers.id, paper.id));
    console.log('\nDatabase updated successfully!');
  } else {
    console.log('\nNo [Image: xxx] markers found in question text. Checking all fields...');
    console.log(JSON.stringify(rwPart3, null, 2));
  }
  
  process.exit(0);
}
main();
