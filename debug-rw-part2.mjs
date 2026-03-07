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
  console.log('=== R&W Part 2 Full Data ===');
  console.log(JSON.stringify(rwPart2, null, 2));
  
  process.exit(0);
}
main();
