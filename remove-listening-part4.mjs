import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import { customPapers } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  const db = drizzle(process.env.DATABASE_URL);
  
  const papers = await db.select().from(customPapers)
    .where(eq(customPapers.title, 'G1 English Proficiency Test'));
  
  if (!papers.length) {
    console.error('Paper not found!');
    process.exit(1);
  }
  
  const paper = papers[0];
  const sections = JSON.parse(paper.sectionsJson);
  
  console.log('Before removal:');
  sections.forEach((s, i) => console.log(`  Section ${i}: ${s.title} (${s.questions.length} questions)`));
  
  // Remove Listening Part 4 (index 3)
  const filteredSections = sections.filter(s => s.title !== 'Listening Part 4');
  
  // Recalculate total questions
  const totalQuestions = filteredSections.reduce((sum, s) => sum + s.questions.length, 0);
  
  console.log('\nAfter removal:');
  filteredSections.forEach((s, i) => console.log(`  Section ${i}: ${s.title} (${s.questions.length} questions)`));
  console.log(`Total questions: ${totalQuestions}`);
  
  // Update the database
  await db.update(customPapers)
    .set({
      sectionsJson: JSON.stringify(filteredSections),
      totalQuestions: totalQuestions,
    })
    .where(eq(customPapers.id, paper.id));
  
  console.log('\n✅ Listening Part 4 removed successfully!');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
