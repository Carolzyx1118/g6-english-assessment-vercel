import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import { customPapers } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  const db = drizzle(process.env.DATABASE_URL);
  const papers = await db.select().from(customPapers).where(eq(customPapers.title, 'G1 English Proficiency Test'));
  const sections = JSON.parse(papers[0].sectionsJson);
  
  for (const s of sections) {
    for (const q of s.questions) {
      if (q.type === 'picture-mcq' || q.type === 'listening-mcq') {
        const opt = q.options[q.correctAnswer];
        const correctText = opt ? (opt.text || opt.label) : undefined;
        if (correctText === undefined || correctText === null) {
          console.log('UNDEFINED correctText:', s.id, 'Q' + q.id, 'type=' + q.type, 'correctAnswer=' + q.correctAnswer, 'opt=' + JSON.stringify(opt));
        }
      } else if (q.type === 'mcq') {
        if (typeof q.correctAnswer === 'number') {
          const correctText = q.options[q.correctAnswer];
          if (correctText === undefined || correctText === null) {
            console.log('UNDEFINED correctText:', s.id, 'Q' + q.id, 'type=mcq(num)', 'correctAnswer=' + q.correctAnswer);
          }
        }
      }
    }
  }
  console.log('Done');
  process.exit(0);
}
main();
