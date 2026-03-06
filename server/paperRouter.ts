import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { processAllExamImages, type CroppedImage } from "./imageCropper";
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

3. **fill-blank**: Fill in the blank (used with word bank and grammarPassage).
   IMPORTANT: There are TWO modes for fill-blank:
   
   MODE A - PASSAGE-BASED (when the section has a grammarPassage):
   - The grammarPassage MUST use exactly this blank format: <b>(N) ___</b> where N is the question ID
   - Example grammarPassage: "The cat sat <b>(21) ___</b> the mat. It was <b>(22) ___</b> happy."
   - The correctAnswer MUST be the LETTER from the wordBank (e.g., "A", "B", "K")
   - Each word bank item can only be used once
   - Example: { "id": 21, "type": "fill-blank", "correctAnswer": "A" }
   - wordBank example: [{"letter": "A", "word": "although"}, {"letter": "B", "word": "because"}]
   
   MODE B - SENTENCE-BASED (when there is NO grammarPassage):
   - Each question MUST have a "question" field with the full sentence containing ___
   - The correctAnswer is the WORD itself (e.g., "inside", "next to")
   - Words can be reused across blanks
   - Example: { "id": 1, "type": "fill-blank", "question": "The rubber is ___ the pencil case.", "correctAnswer": "inside" }
   - wordBank example: [{"letter": "A", "word": "inside"}, {"letter": "B", "word": "next to"}]

4. **listening-mcq**: Listening comprehension MCQ with picture options.
   { "id": 1, "type": "listening-mcq", "question": "What is the man's job?", "options": [{"label": "a", "imageUrl": "", "text": "Doctor"}, ...], "correctAnswer": 0 }

5. **wordbank-fill**: Word bank fill-in for reading comprehension.
   { "id": 1, "type": "wordbank-fill", "question": "Fill in blank 1", "correctAnswer": "happy" }

6. **story-fill**: Story comprehension fill-in.
   { "id": 1, "type": "story-fill", "question": "Fill in blank 1", "correctAnswer": "brave", "acceptableAnswers": ["courageous"] }

7. **open-ended**: Open-ended question with optional sub-questions.
   WITHOUT sub-questions: { "id": 1, "type": "open-ended", "question": "What did the author mean?", "answer": "The author meant..." }
   WITH sub-questions - MUST use this EXACT object format (NOT string arrays):
   { "id": 1, "type": "open-ended", "question": "Answer the following:", "subQuestions": [{"label": "a", "question": "Who is the main character?", "answer": "Tom"}, {"label": "b", "question": "What happened next?", "answer": "He went home"}] }
   CRITICAL: subQuestions MUST be an array of objects with {label, question, answer}. NEVER use string arrays like ["a", "b"].

8. **true-false**: True/False statements.
   MUST use this EXACT format - each statement is an object with label, statement, isTrue, and reason:
   { "id": 1, "type": "true-false", "statements": [{"label": "a", "statement": "The sky is blue.", "isTrue": true, "reason": "As stated in paragraph 1"}, {"label": "b", "statement": "Fish can fly.", "isTrue": false, "reason": "Fish live in water"}] }
   CRITICAL: statements MUST be an array of objects with {label, statement, isTrue, reason}. NEVER use separate arrays for statements/trueFalseStatements/reasons.

9. **checkbox**: Multiple correct answers.
   { "id": 1, "type": "checkbox", "question": "Which are fruits?", "options": ["Apple", "Car", "Banana", "Table"], "correctAnswers": [0, 2] }

10. **writing**: Writing prompt.
    { "id": 1, "type": "writing", "topic": "My Best Friend", "instructions": "Write about your best friend.", "wordCount": "80-120 words", "prompts": ["Who is your best friend?", "What do you do together?"] }

11. **table**: Table completion question. Each row MUST be an object with situation, thought, action, blankField, and answer.
    MUST use this EXACT format:
    { "id": 1, "type": "table", "question": "Complete the table", "rows": [
      {"situation": "The old man offered his umbrella.", "thought": "Mother had doubts.", "action": "", "blankField": "action", "answer": "She gave him five dollars."},
      {"situation": "Mother spotted the old man.", "thought": "", "action": "Mother followed him.", "blankField": "thought", "answer": "Mother suspected he was lying."}
    ]}
    CRITICAL: rows MUST be an array of objects with {situation, thought, action, blankField, answer}.
    - blankField is "thought" or "action" - it indicates which cell the student fills in.
    - The blank cell should have an empty string "" as its value.
    - The answer field contains the correct answer for the blank cell.
    - NEVER use rows as column headers like ["situation", "thought", "action"].
    - NEVER use separate tableData/tableData2 arrays.

12. **reference**: Word reference question. Each item MUST be an object with word, lineRef, and answer.
    MUST use this EXACT format:
    { "id": 1, "type": "reference", "question": "What do these words refer to?", "items": [
      {"word": "it", "lineRef": "line 3", "answer": "the book"},
      {"word": "them", "lineRef": "paragraph 2", "answer": "the children"}
    ]}
    CRITICAL: items MUST be an array of objects with {word, lineRef, answer}.
    - NEVER use items as a string array like ["it (line 3)", "them (line 8)"].
    - NEVER use a separate answers array.

13. **order**: Event ordering question.
    { "id": 1, "type": "order", "question": "Put the events in order", "events": ["Tom went home", "Tom ate dinner", "Tom slept"], "correctOrder": [1, 2, 3] }

14. **phrase**: Phrase/vocabulary matching. Each item MUST be an object with clue and answer.
    MUST use this EXACT format:
    { "id": 1, "type": "phrase", "question": "Find phrases that mean:", "items": [
      {"clue": "Which three-word phrase tells you he was surprised?", "answer": "to his amazement"},
      {"clue": "Which word means very happy?", "answer": "overjoyed"}
    ]}
    CRITICAL: items MUST be an array of objects with {clue, answer}.
    - NEVER use items as a string array with a separate answers array.

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
  "passage": "",  // optional: reading passage text (for reading comprehension sections)
  "wordBank": [],  // optional: [{"letter": "A", "word": "although"}] - letters MUST be uppercase single letters
  "grammarPassage": "",  // optional: passage with <b>(N) ___</b> blanks for fill-blank questions
  "audioUrl": "",  // optional: URL for listening audio
  "sceneImageUrl": "",  // optional: scene image URL
  "storyParagraphs": []  // optional: [{"text": "paragraph text", "questionIds": [1,2]}]
}

IMPORTANT RULES:
- Question IDs must be GLOBALLY UNIQUE across all sections (e.g., section 1: IDs 1-10, section 2: IDs 11-20, etc.)
- Section IDs must be unique lowercase strings (e.g., "vocabulary", "grammar", "listening", "reading", "writing")
- Use appropriate colors for each section (green for vocabulary, amber for grammar, purple for listening, blue for reading, rose for writing)
- The correctAnswer for MCQ types is a 0-based index
- For fill-blank with grammarPassage: blanks MUST use <b>(N) ___</b> format, correctAnswer is the LETTER
- For fill-blank without grammarPassage: each question MUST have a "question" field with ___, correctAnswer is the WORD
- For listening sections, include audioUrl (will be provided separately)
- For reading sections with a passage, put the passage text in the "passage" field
- Ensure all text content is properly escaped for JSON
- wordBank letters MUST be uppercase single letters: A, B, C, D, etc.

IMAGE HANDLING - CRITICAL:
- You will be given a list of AVAILABLE_IMAGE_URLS that correspond to the uploaded images.
- When you see images in the test materials that correspond to questions or options, you MUST use the actual URLs from AVAILABLE_IMAGE_URLS.
- For picture-mcq: set each option's "imageUrl" to the matching image URL from AVAILABLE_IMAGE_URLS.
- For mcq with images: set the question's "imageUrl" to the matching image URL.
- For sections with a scene image: set "sceneImageUrl" to the matching image URL.
- If the test paper has multiple images on one page, map each image to the correct question/option based on its position and context.
- If you cannot determine which URL matches which image, assign them in order (first image URL to first question that needs an image, etc.).
- NEVER leave imageUrl as empty string "" if there are available images that clearly belong to that question.
- If a question references an image but no matching URL is available, set imageUrl to "" and add a note in the question text like "[Image needed]".

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

      // Phase 1: Crop individual images from uploaded exam pages
      const allImageUrls = input.imageUrls || [];
      let croppedImages: CroppedImage[] = [];
      if (allImageUrls.length > 0) {
        console.log(`[Paper Parser] Processing ${allImageUrls.length} images for cropping...`);
        try {
          croppedImages = await processAllExamImages(allImageUrls);
          console.log(`[Paper Parser] Cropped ${croppedImages.length} individual images`);
        } catch (err) {
          console.error("[Paper Parser] Image cropping failed, using original URLs:", err);
        }
      }

      // Pass both original and cropped image URLs as available resources
      if (allImageUrls.length > 0) {
        textPrompt += `ORIGINAL_PAGE_IMAGES (full page scans - use for scene images or if no cropped version available):\n`;
        allImageUrls.forEach((url, i) => {
          textPrompt += `  Page ${i + 1}: ${url}\n`;
        });
        textPrompt += `\n`;
      }
      if (croppedImages.length > 0) {
        textPrompt += `CROPPED_INDIVIDUAL_IMAGES (already cropped from the pages above - PREFER these over full page images):\n`;
        croppedImages.forEach((img, i) => {
          textPrompt += `  Crop ${i + 1}: ${img.url} — ${img.description} [suggested target: ${img.target}]\n`;
        });
        textPrompt += `\nIMPORTANT: Use the CROPPED image URLs above in imageUrl fields. Match each cropped image to the correct question/option based on the description and suggested target. Use the EXACT URL strings in your output JSON.\n`;
        textPrompt += `For picture-mcq options, set each option's "imageUrl" to the matching cropped image URL.\n`;
        textPrompt += `For scene images, use either a cropped image or the full page image URL.\n\n`;
      } else if (allImageUrls.length > 0) {
        textPrompt += `AVAILABLE_IMAGE_URLS (use these exact URLs in imageUrl fields when you identify matching images):\n`;
        allImageUrls.forEach((url, i) => {
          textPrompt += `  Image ${i + 1}: ${url}\n`;
        });
        textPrompt += `\nIMPORTANT: Map each image above to the correct question or option based on what you see in the image content. Use the EXACT URL strings above in the imageUrl fields of your output JSON.\n\n`;
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
