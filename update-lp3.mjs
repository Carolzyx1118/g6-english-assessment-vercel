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
  
  const lp3 = sections.find(s => s.title && s.title.includes('Listening') && s.title.includes('Part 3'));
  if (!lp3) { console.error('Listening Part 3 not found'); process.exit(1); }

  console.log('Before - questions count:', lp3.questions.length);

  // Add storyImages
  lp3.storyImages = [
    'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/eQrKqAUggEoTOozH.png',
    'https://files.manuscdn.com/user_upload_by_module/session_file/310519663325188422/pTcQGIqpNWQnBDDO.png'
  ];

  // Update description
  lp3.description = 'Listen and tick (✓) the box. There is one example.';

  // Rewrite all 5 questions based on the images
  // Note: correctAnswer index is set to 0 for now - teacher needs to verify after listening to audio
  lp3.questions = [
    {
      id: 1,
      type: "listening-mcq",
      question: "What is Anna taking to school?",
      options: [
        { label: "A", imageUrl: "", text: "A jacket and some pens" },
        { label: "B", imageUrl: "", text: "Some books and pens" },
        { label: "C", imageUrl: "", text: "A jacket, books and pens" }
      ],
      correctAnswer: 0  // Teacher to verify
    },
    {
      id: 2,
      type: "listening-mcq",
      question: "Which is Bill's dad?",
      options: [
        { label: "A", imageUrl: "", text: "A man washing a car" },
        { label: "B", imageUrl: "", text: "A man playing basketball" },
        { label: "C", imageUrl: "", text: "A boy painting a wall" }
      ],
      correctAnswer: 0  // Teacher to verify
    },
    {
      id: 3,
      type: "listening-mcq",
      question: "What would Sam like to do?",
      options: [
        { label: "A", imageUrl: "", text: "Play tennis" },
        { label: "B", imageUrl: "", text: "Watch a cartoon on TV" },
        { label: "C", imageUrl: "", text: "Watch a nature programme on TV" }
      ],
      correctAnswer: 0  // Teacher to verify
    },
    {
      id: 4,
      type: "listening-mcq",
      question: "Which is Jill's bedroom?",
      options: [
        { label: "A", imageUrl: "", text: "A bedroom with a computer" },
        { label: "B", imageUrl: "", text: "A bedroom with a bed and lamp" },
        { label: "C", imageUrl: "", text: "A bedroom with a bed and red rug" }
      ],
      correctAnswer: 0  // Teacher to verify
    },
    {
      id: 5,
      type: "listening-mcq",
      question: "Which is Nick's brother?",
      options: [
        { label: "A", imageUrl: "", text: "A boy watching a football match" },
        { label: "B", imageUrl: "", text: "A boy holding a burger and smiling" },
        { label: "C", imageUrl: "", text: "A boy with a camera" }
      ],
      correctAnswer: 0  // Teacher to verify
    }
  ];

  console.log('After - questions count:', lp3.questions.length);
  lp3.questions.forEach((q, i) => {
    console.log(`  Q${i+1}: ${q.question}`);
    q.options.forEach(o => console.log(`    ${o.label}: ${o.text}`));
  });

  await db.update(customPapers)
    .set({ sectionsJson: JSON.stringify(sections) })
    .where(eq(customPapers.id, paper.id));
  
  console.log('Done! Listening Part 3 re-recorded with correct questions and images.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
