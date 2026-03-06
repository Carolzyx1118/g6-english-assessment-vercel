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
  
  const lp1 = sections.find(s => s.title && s.title.includes('Listening') && s.title.includes('Part 1'));
  if (!lp1) { console.error('Listening Part 1 not found'); process.exit(1); }

  // Based on the answer key:
  // 1. Grace → the girl reading under the tree
  // 2. Dan → the boy waving and holding a bat
  // 3. Alex → the boy skateboarding
  // 4. Eva → the girl with purple boots, flying a kite
  // 5. Alice → the girl with black hair, playing a board game
  
  // Rewrite all 5 questions with correct options and answers
  lp1.questions = [
    {
      id: 1,
      type: "listening-mcq",
      question: "Where should you draw the line for 'Grace'?",
      options: [
        { label: "a", imageUrl: "", text: "The girl reading under the tree" },
        { label: "b", imageUrl: "", text: "The girl flying a kite" },
        { label: "c", imageUrl: "", text: "The girl playing a board game" },
        { label: "d", imageUrl: "", text: "The girl on the skateboard" }
      ],
      correctAnswer: 0  // a: the girl reading under the tree
    },
    {
      id: 2,
      type: "listening-mcq",
      question: "Where should you draw the line for 'Dan'?",
      options: [
        { label: "a", imageUrl: "", text: "The boy skateboarding" },
        { label: "b", imageUrl: "", text: "The boy waving and holding a bat" },
        { label: "c", imageUrl: "", text: "The boy fishing by the pond" },
        { label: "d", imageUrl: "", text: "The boy playing chess" }
      ],
      correctAnswer: 1  // b: the boy waving and holding a bat
    },
    {
      id: 3,
      type: "listening-mcq",
      question: "Where should you draw the line for 'Alex'?",
      options: [
        { label: "a", imageUrl: "", text: "The boy waving and holding a bat" },
        { label: "b", imageUrl: "", text: "The boy fishing by the pond" },
        { label: "c", imageUrl: "", text: "The boy skateboarding" },
        { label: "d", imageUrl: "", text: "The boy playing chess" }
      ],
      correctAnswer: 2  // c: the boy skateboarding
    },
    {
      id: 4,
      type: "listening-mcq",
      question: "Where should you draw the line for 'Eva'?",
      options: [
        { label: "a", imageUrl: "", text: "The girl reading under the tree" },
        { label: "b", imageUrl: "", text: "The girl with purple boots, flying a kite" },
        { label: "c", imageUrl: "", text: "The girl playing a board game" },
        { label: "d", imageUrl: "", text: "The girl skipping rope" }
      ],
      correctAnswer: 1  // b: the girl with purple boots, flying a kite
    },
    {
      id: 5,
      type: "listening-mcq",
      question: "Where should you draw the line for 'Alice'?",
      options: [
        { label: "a", imageUrl: "", text: "The girl flying a kite" },
        { label: "b", imageUrl: "", text: "The girl reading under the tree" },
        { label: "c", imageUrl: "", text: "The girl with black hair, playing a board game" },
        { label: "d", imageUrl: "", text: "The girl skipping rope" }
      ],
      correctAnswer: 2  // c: the girl with black hair, playing a board game
    }
  ];

  console.log('Updated questions:');
  lp1.questions.forEach((q, i) => {
    const correct = q.options[q.correctAnswer].text;
    console.log(`  Q${i+1}: ${q.question} → Answer: ${correct}`);
  });

  await db.update(customPapers)
    .set({ sectionsJson: JSON.stringify(sections) })
    .where(eq(customPapers.id, paper.id));
  
  console.log('Done! Listening Part 1 answers updated.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
