import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import { customPapers } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  const db = drizzle(process.env.DATABASE_URL);
  const papers = await db.select().from(customPapers).where(eq(customPapers.title, 'G1 English Proficiency Test'));
  if (!papers.length) { console.error('Paper not found'); process.exit(1); }
  
  const paper = papers[0];
  const sections = JSON.parse(paper.sectionsJson);
  
  const rwPart1 = sections.find(s => s.title && s.title.includes('Reading & Writing') && s.title.includes('Part 1'));
  if (!rwPart1) { console.error('R&W Part 1 not found'); process.exit(1); }
  
  console.log('Found section:', rwPart1.title);
  console.log('Current storyImages:', rwPart1.storyImages);
  
  const newImageUrl = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/OWWbUXwUNoBavstW.png';
  
  // Add to storyImages array (create if doesn't exist)
  if (!rwPart1.storyImages) {
    rwPart1.storyImages = [];
  }
  rwPart1.storyImages.push(newImageUrl);
  
  console.log('Updated storyImages:', rwPart1.storyImages);
  
  await db.update(customPapers)
    .set({ sectionsJson: JSON.stringify(sections) })
    .where(eq(customPapers.id, paper.id));
  
  console.log('Done! R&W Part 1 now has', rwPart1.storyImages.length, 'story images');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
