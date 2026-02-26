import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import {
  saveCustomPaper,
  getAllCustomPapers,
  getCustomPaperById,
  getPublishedCustomPapers,
  updateCustomPaper,
  deleteCustomPaper,
} from "./db";

/**
 * Generate a URL-safe slug from a title
 */
function generatePaperId(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const suffix = Date.now().toString(36);
  return `custom-${slug || "paper"}-${suffix}`;
}

/**
 * The AI prompt that describes the paper format for parsing uploaded materials.
 * This is the core of the paper creation system.
 */
const PAPER_FORMAT_PROMPT = `You are an expert at creating English proficiency assessment papers. 
You will receive uploaded test materials (PDF text, images, or descriptions) and must convert them into a structured JSON format.

The paper has SECTIONS, each section contains QUESTIONS. Here are the supported question types:

1. **picture-mcq**: Picture-based multiple choice. Student sees images as options.
   { "id": 1, "type": "picture-mcq", "question": "five", "options": [{"label": "a", "imageUrl": "", "text": "four"}, ...], "correctAnswer": 1 }
   Note: correctAnswer is the 0-based index of the correct option. imageUrl can be empty if no images.

2. **mcq**: Standard text multiple choice with optional image.
   { "id": 1, "type": "mcq", "question": "Choose the correct word: The cat ___ on the mat.", "highlightWord": "sat", "options": ["sit", "sat", "set", "seat"], "correctAnswer": 1, "imageUrl": "" }

3. **fill-blank**: Fill in the blank (used with word bank).
   { "id": 1, "type": "fill-blank", "correctAnswer": "although" }
   Note: Used with section-level wordBank and grammarPassage.

4. **listening-mcq**: Listening comprehension MCQ with picture options.
   { "id": 1, "type": "listening-mcq", "question": "What is the man's job?", "options": [{"label": "a", "imageUrl": "", "text": "Doctor"}, ...], "correctAnswer": 0 }

5. **wordbank-fill**: Word bank fill-in for reading comprehension.
   { "id": 1, "type": "wordbank-fill", "question": "Fill in blank 1", "correctAnswer": "happy" }

6. **story-fill**: Story comprehension fill-in.
   { "id": 1, "type": "story-fill", "question": "Fill in blank 1", "correctAnswer": "brave", "acceptableAnswers": ["courageous"] }

7. **open-ended**: Open-ended question with optional sub-questions.
   { "id": 1, "type": "open-ended", "question": "What did the author mean?", "answer": "The author meant..." }
   With sub-questions: { "id": 1, "type": "open-ended", "question": "Answer the following:", "subQuestions": [{"label": "a", "question": "Who is the main character?", "answer": "Tom"}] }

8. **true-false**: True/False statements.
   { "id": 1, "type": "true-false", "statements": [{"label": "a", "statement": "The sky is blue.", "isTrue": true, "reason": "As stated in paragraph 1"}] }

9. **checkbox**: Multiple correct answers.
   { "id": 1, "type": "checkbox", "question": "Which are fruits?", "options": ["Apple", "Car", "Banana", "Table"], "correctAnswers": [0, 2] }

10. **writing**: Writing prompt.
    { "id": 1, "type": "writing", "topic": "My Best Friend", "instructions": "Write about your best friend.", "wordCount": "80-120 words", "prompts": ["Who is your best friend?", "What do you do together?"] }

11. **table**: Table completion question.
    { "id": 1, "type": "table", "question": "Complete the table", "rows": [{"situation": "At the park", "thought": "I want to play", "action": "", "blankField": "action", "answer": "Go to the swings"}] }

12. **reference**: Word reference question.
    { "id": 1, "type": "reference", "question": "What do these words refer to?", "items": [{"word": "it", "lineRef": "line 3", "answer": "the book"}] }

13. **order**: Event ordering question.
    { "id": 1, "type": "order", "question": "Put the events in order", "events": ["Tom went home", "Tom ate dinner", "Tom slept"], "correctOrder": [1, 2, 3] }

14. **phrase**: Phrase/vocabulary matching.
    { "id": 1, "type": "phrase", "question": "Find phrases that mean:", "items": [{"clue": "very happy", "answer": "overjoyed"}] }

Each SECTION has this structure:
{
  "id": "vocabulary",  // unique section id (lowercase, no spaces)
  "title": "Part 1: Vocabulary",
  "subtitle": "Choose the correct answer",
  "icon": "📖",
  "color": "text-[oklch(0.55_0.16_160)]",
  "bgColor": "bg-[oklch(0.95_0.04_160)]",
  "description": "Look at the pictures and choose the correct answer.",
  "questions": [...],
  "passage": "",  // optional: reading passage text
  "wordBank": [],  // optional: [{letter: "A", word: "although"}]
  "grammarPassage": "",  // optional: passage with blanks for fill-blank questions
  "audioUrl": "",  // optional: URL for listening audio
  "sceneImageUrl": "",  // optional: scene image URL
  "storyParagraphs": []  // optional: [{text: "paragraph text", questionIds: [1,2]}]
}

IMPORTANT RULES:
- Question IDs must be sequential within each section, starting from 1
- Section IDs must be unique lowercase strings (e.g., "vocabulary", "grammar", "listening", "reading", "writing")
- Use appropriate colors for each section (green for vocabulary, amber for grammar, purple for listening, blue for reading, rose for writing)
- The correctAnswer for MCQ types is a 0-based index
- For fill-blank questions, the section needs a wordBank and grammarPassage
- For listening sections, include audioUrl (will be provided separately)
- Ensure all text content is properly escaped for JSON

Return a JSON object with this structure:
{
  "title": "Paper Title",
  "subtitle": "Grade Level or Description",
  "description": "Brief description of the paper",
  "sections": [...],
  "totalQuestions": <number>,
  "hasListening": <boolean>,
  "hasWriting": <boolean>
}`;

export const paperRouter = router({
  // Upload a file to S3 and return the URL
  uploadFile: publicProcedure
    .input(
      z.object({
        fileName: z.string(),
        fileBase64: z.string(),
        contentType: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const suffix = Math.random().toString(36).slice(2, 10);
      const ext = input.fileName.split(".").pop() || "bin";
      const key = `paper-assets/${suffix}-${input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const buffer = Buffer.from(input.fileBase64, "base64");
      const { url } = await storagePut(key, buffer, input.contentType);
      return { url, key };
    }),

  // AI-parse uploaded materials into paper format
  parseMaterials: publicProcedure
    .input(
      z.object({
        // Text content extracted from uploaded files
        textContent: z.string().optional(),
        // URLs of uploaded images for AI to analyze
        imageUrls: z.array(z.string()).optional(),
        // URLs of uploaded PDFs for AI to analyze
        pdfUrls: z.array(z.string()).optional(),
        // Audio URLs (for listening sections)
        audioUrls: z.array(z.string()).optional(),
        // Additional instructions from the teacher
        instructions: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const messages: any[] = [
        {
          role: "system",
          content: PAPER_FORMAT_PROMPT,
        },
      ];

      // Build the user message with all available content
      const contentParts: any[] = [];

      let textPrompt = "Please parse the following test materials into the structured paper format.\n\n";

      if (input.instructions) {
        textPrompt += `Teacher's instructions: ${input.instructions}\n\n`;
      }

      if (input.audioUrls && input.audioUrls.length > 0) {
        textPrompt += `Audio files for listening section: ${input.audioUrls.join(", ")}\n\n`;
      }

      if (input.textContent) {
        textPrompt += `Extracted text content:\n${input.textContent}\n\n`;
      }

      contentParts.push({ type: "text", text: textPrompt });

      // Add images for vision analysis
      if (input.imageUrls && input.imageUrls.length > 0) {
        for (const url of input.imageUrls) {
          contentParts.push({
            type: "image_url",
            image_url: { url, detail: "high" },
          });
        }
      }

      // Add PDFs for analysis
      if (input.pdfUrls && input.pdfUrls.length > 0) {
        for (const url of input.pdfUrls) {
          contentParts.push({
            type: "file_url",
            file_url: { url, mime_type: "application/pdf" },
          });
        }
      }

      messages.push({ role: "user", content: contentParts });

      try {
        const response = await invokeLLM({
          messages,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "paper_structure",
              strict: false,
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  subtitle: { type: "string" },
                  description: { type: "string" },
                  sections: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        title: { type: "string" },
                        subtitle: { type: "string" },
                        icon: { type: "string" },
                        color: { type: "string" },
                        bgColor: { type: "string" },
                        description: { type: "string" },
                        questions: { type: "array" },
                        passage: { type: "string" },
                        wordBank: { type: "array" },
                        grammarPassage: { type: "string" },
                        audioUrl: { type: "string" },
                        sceneImageUrl: { type: "string" },
                        storyParagraphs: { type: "array" },
                      },
                      required: ["id", "title", "subtitle", "icon", "color", "bgColor", "description", "questions"],
                    },
                  },
                  totalQuestions: { type: "number" },
                  hasListening: { type: "boolean" },
                  hasWriting: { type: "boolean" },
                },
                required: ["title", "subtitle", "description", "sections", "totalQuestions", "hasListening", "hasWriting"],
              },
            },
          },
        });

        const content = response.choices[0]?.message?.content;
        if (typeof content === "string") {
          return JSON.parse(content);
        }
        throw new Error("No content in AI response");
      } catch (err) {
        console.error("[Paper Parser] AI parsing error:", err);
        throw new Error("Failed to parse materials. Please try again or provide clearer materials.");
      }
    }),

  // Save a new paper to the database
  create: publicProcedure
    .input(
      z.object({
        title: z.string(),
        subtitle: z.string().optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        totalQuestions: z.number(),
        hasListening: z.boolean(),
        hasWriting: z.boolean(),
        sectionsJson: z.string(),
        readingWordBankJson: z.string().optional(),
        sourceFilesJson: z.string().optional(),
        status: z.enum(["draft", "published"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const paperId = generatePaperId(input.title);
      const id = await saveCustomPaper({
        paperId,
        title: input.title,
        subtitle: input.subtitle || null,
        description: input.description || null,
        icon: input.icon || "📝",
        color: input.color || "text-blue-600",
        totalQuestions: input.totalQuestions,
        hasListening: input.hasListening ? 1 : 0,
        hasWriting: input.hasWriting ? 1 : 0,
        sectionsJson: input.sectionsJson,
        readingWordBankJson: input.readingWordBankJson || null,
        sourceFilesJson: input.sourceFilesJson || null,
        status: input.status || "draft",
      });
      return { id, paperId };
    }),

  // Update an existing paper
  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().optional(),
        subtitle: z.string().optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        totalQuestions: z.number().optional(),
        hasListening: z.boolean().optional(),
        hasWriting: z.boolean().optional(),
        sectionsJson: z.string().optional(),
        readingWordBankJson: z.string().optional(),
        status: z.enum(["draft", "published"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, hasListening, hasWriting, ...rest } = input;
      const updates: any = { ...rest };
      if (hasListening !== undefined) updates.hasListening = hasListening ? 1 : 0;
      if (hasWriting !== undefined) updates.hasWriting = hasWriting ? 1 : 0;
      await updateCustomPaper(id, updates);
      return { success: true };
    }),

  // List all papers (for admin)
  list: publicProcedure.query(async () => {
    const papers = await getAllCustomPapers();
    return papers.map((p) => ({
      id: p.id,
      paperId: p.paperId,
      title: p.title,
      subtitle: p.subtitle,
      description: p.description,
      icon: p.icon,
      color: p.color,
      totalQuestions: p.totalQuestions,
      hasListening: !!p.hasListening,
      hasWriting: !!p.hasWriting,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }),

  // List published papers (for students)
  listPublished: publicProcedure.query(async () => {
    const papers = await getPublishedCustomPapers();
    return papers.map((p) => ({
      paperId: p.paperId,
      title: p.title,
      subtitle: p.subtitle,
      description: p.description,
      icon: p.icon,
      color: p.color,
      totalQuestions: p.totalQuestions,
      hasListening: !!p.hasListening,
      hasWriting: !!p.hasWriting,
      sectionsJson: p.sectionsJson,
      readingWordBankJson: p.readingWordBankJson,
    }));
  }),

  // Get a single paper by database ID (for editing)
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const paper = await getCustomPaperById(input.id);
      if (!paper) return null;
      return {
        ...paper,
        hasListening: !!paper.hasListening,
        hasWriting: !!paper.hasWriting,
      };
    }),

  // Delete a paper
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteCustomPaper(input.id);
      return { success: true };
    }),
});
