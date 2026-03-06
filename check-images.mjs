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
        console.log('Section:', s.title, 'Q:', q.id, 'Type:', q.type);
        if (q.options) {
          q.options.forEach((opt, i) => {
            console.log('  opt', i, 'imageUrl:', JSON.stringify(opt.imageUrl || ''), 'text:', (opt.text || '').substring(0, 40));
          });
        }
      }
    }
  }
  
  // Also check all papers for any with picture-mcq/listening-mcq
  const allPapers = await db.select().from(customPapers);
  for (const p of allPapers) {
    const secs = JSON.parse(p.sectionsJson);
    let hasPicMcq = false;
    for (const s of secs) {
      for (const q of s.questions) {
        if ((q.type === 'picture-mcq' || q.type === 'listening-mcq') && q.options) {
          const hasEmptyImg = q.options.some(o => !o.imageUrl || o.imageUrl === '');
          if (hasEmptyImg) {
            hasPicMcq = true;
            console.log(`\nPaper "${p.title}" Section "${s.title}" Q${q.id} has options with empty imageUrl`);
          }
        }
      }
    }
  }
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
