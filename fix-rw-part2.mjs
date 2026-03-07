import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import { customPapers } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  const db = drizzle(process.env.DATABASE_URL);
  const papers = await db.select().from(customPapers).where(eq(customPapers.title, 'G1 English Proficiency Test'));
  const paper = papers[0];
  const sections = JSON.parse(paper.sectionsJson);
  
  const rwPart2 = sections.find(s => s.id === 'rw-part2');
  if (!rwPart2) {
    console.log('rw-part2 not found!');
    process.exit(1);
  }
  
  console.log('=== BEFORE ===');
  for (const q of rwPart2.questions) {
    console.log(`Q${q.id}: type=${q.type} correctAnswer=${JSON.stringify(q.correctAnswer)} question="${q.question}"`);
  }
  
  // New answers: no, yes, yes, no, yes
  const newAnswers = ['no', 'yes', 'yes', 'no', 'yes'];
  
  for (let i = 0; i < rwPart2.questions.length && i < newAnswers.length; i++) {
    rwPart2.questions[i].correctAnswer = newAnswers[i];
  }
  
  console.log('\n=== AFTER ===');
  for (const q of rwPart2.questions) {
    console.log(`Q${q.id}: type=${q.type} correctAnswer=${JSON.stringify(q.correctAnswer)} question="${q.question}"`);
  }
  
  await db.update(customPapers)
    .set({ sectionsJson: JSON.stringify(sections) })
    .where(eq(customPapers.id, paper.id));
  console.log('\nDatabase updated successfully!');
  
  process.exit(0);
}
main();
