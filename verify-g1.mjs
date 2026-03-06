import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import { customPapers } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);
const papers = await db.select({
  id: customPapers.id,
  paperId: customPapers.paperId,
  title: customPapers.title,
  totalQuestions: customPapers.totalQuestions,
  status: customPapers.status,
  hasListening: customPapers.hasListening,
}).from(customPapers).where(eq(customPapers.title, 'G1 English Proficiency Test'));
console.log(JSON.stringify(papers, null, 2));
process.exit(0);
