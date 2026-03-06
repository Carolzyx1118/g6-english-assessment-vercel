import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import { customPapers } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  const db = drizzle(process.env.DATABASE_URL);
  const papers = await db.select().from(customPapers).where(eq(customPapers.title, 'G1 English Proficiency Test'));
  const sections = JSON.parse(papers[0].sectionsJson);
  for (const s of sections) {
    const types = [...new Set(s.questions.map(q => q.type))];
    console.log(s.id, s.title, '- types:', types.join(', '), '- count:', s.questions.length);
    // Show first question's correctAnswer type
    if (s.questions[0]) {
      console.log('  Q1 correctAnswer:', JSON.stringify(s.questions[0].correctAnswer), 'type:', typeof s.questions[0].correctAnswer);
    }
  }
  process.exit(0);
}
main();
