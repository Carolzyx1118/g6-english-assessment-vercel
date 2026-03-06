import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import { customPapers } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

const ZOO_IMAGE_1 = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/FBNeFJmTOwYEPwPh.png';
const ZOO_IMAGE_2 = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/zHlZwiEjQkyFAXod.png';

async function main() {
  const db = drizzle(process.env.DATABASE_URL);
  const papers = await db.select().from(customPapers).where(eq(customPapers.title, 'G1 English Proficiency Test'));
  
  if (papers.length === 0) {
    console.error('G1 paper not found');
    process.exit(1);
  }
  
  const paper = papers[0];
  const sections = JSON.parse(paper.sectionsJson);
  
  // Find R&W Part 5
  const part5 = sections.find(s => s.title && s.title.includes('Part 5'));
  if (!part5) {
    console.error('R&W Part 5 not found');
    console.log('Available sections:', sections.map(s => s.title));
    process.exit(1);
  }
  
  console.log('Found Part 5:', part5.title);
  console.log('Old sceneImageUrl:', part5.sceneImageUrl);
  
  // Replace with two images - use storyImages array for multiple images
  part5.sceneImageUrl = ZOO_IMAGE_1;
  part5.storyImages = [ZOO_IMAGE_1, ZOO_IMAGE_2];
  
  console.log('New sceneImageUrl:', part5.sceneImageUrl);
  console.log('New storyImages:', part5.storyImages);
  
  // Update the paper
  await db.update(customPapers)
    .set({ sectionsJson: JSON.stringify(sections) })
    .where(eq(customPapers.id, paper.id));
  
  console.log('Part 5 images updated successfully!');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
