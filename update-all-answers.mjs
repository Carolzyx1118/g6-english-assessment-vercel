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

  // Helper to find section by partial title match
  function findSection(keyword1, keyword2) {
    return sections.find(s => s.title && s.title.includes(keyword1) && s.title.includes(keyword2));
  }

  // === Listening Part 2 ===
  const lp2 = findSection('Listening', 'Part 2');
  if (lp2) {
    const answers = ['Ben', '12', '5', '18', 'Hall'];
    lp2.questions.forEach((q, i) => {
      if (i < answers.length) {
        q.correctAnswer = answers[i];
        console.log(`LP2 Q${i+1}: answer set to "${answers[i]}"`);
      }
    });
  } else {
    console.error('Listening Part 2 not found');
  }

  // === Listening Part 3 ===
  const lp3 = findSection('Listening', 'Part 3');
  if (lp3) {
    // B=1, C=2, B=1, B=1, A=0
    const answers = [1, 2, 1, 1, 0];
    lp3.questions.forEach((q, i) => {
      if (i < answers.length) {
        q.correctAnswer = answers[i];
        const label = ['A', 'B', 'C'][answers[i]];
        console.log(`LP3 Q${i+1}: answer set to ${label} (index ${answers[i]})`);
      }
    });
  } else {
    console.error('Listening Part 3 not found');
  }

  // === R&W Part 2 (yes/no) ===
  const rw2 = findSection('Reading', 'Part 2');
  if (rw2) {
    const answers = ['no', 'yes', 'yes', 'no', 'yes'];
    rw2.questions.forEach((q, i) => {
      if (i < answers.length) {
        q.correctAnswer = answers[i];
        console.log(`RW2 Q${i+1}: answer set to "${answers[i]}"`);
      }
    });
  } else {
    console.error('R&W Part 2 not found');
  }

  // === R&W Part 3 (spelling) ===
  const rw3 = findSection('Reading', 'Part 3');
  if (rw3) {
    const answers = ['pear', 'lemon', 'orange', 'banana', 'pineapple'];
    rw3.questions.forEach((q, i) => {
      if (i < answers.length) {
        q.correctAnswer = answers[i];
        console.log(`RW3 Q${i+1}: answer set to "${answers[i]}"`);
      }
    });
  } else {
    console.error('R&W Part 3 not found');
  }

  // === R&W Part 4 (fill-in) ===
  const rw4 = findSection('Reading', 'Part 4');
  if (rw4) {
    const answers = ['kitchen', 'dinner', 'book', 'tablet', 'rug'];
    rw4.questions.forEach((q, i) => {
      if (i < answers.length) {
        q.correctAnswer = answers[i];
        console.log(`RW4 Q${i+1}: answer set to "${answers[i]}"`);
      }
    });
  } else {
    console.error('R&W Part 4 not found');
  }

  // === R&W Part 5 (picture questions) ===
  const rw5 = findSection('Reading', 'Part 5');
  if (rw5) {
    // Multiple acceptable answers separated by /
    const answers = ['boy/brother/child', '4/four', 'monkey', 'girl', 'pointing'];
    rw5.questions.forEach((q, i) => {
      if (i < answers.length) {
        q.correctAnswer = answers[i];
        console.log(`RW5 Q${i+1}: answer set to "${answers[i]}"`);
      }
    });
  } else {
    console.error('R&W Part 5 not found');
  }

  // Save
  await db.update(customPapers)
    .set({ sectionsJson: JSON.stringify(sections) })
    .where(eq(customPapers.id, paper.id));
  
  console.log('\nAll answers updated successfully!');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
