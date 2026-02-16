import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  grading: router({
    // AI-powered reading comprehension answer checking
    checkReadingAnswers: publicProcedure
      .input(z.object({
        answers: z.array(z.object({
          questionId: z.number(),
          questionType: z.string(),
          questionText: z.string(),
          userAnswer: z.string(),
          correctAnswer: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        const results: { questionId: number; isCorrect: boolean; score: number; feedback: string }[] = [];

        // Batch all reading answers into one LLM call for efficiency
        const prompt = `You are an English teacher grading a G6 (Grade 6) student's reading comprehension answers. 
For each question below, compare the student's answer with the correct answer. 
The student's answer does NOT need to match word-for-word. Accept answers that convey the same meaning, even if worded differently.
Be lenient with minor spelling errors, but the core meaning must be correct.

For each question, provide:
- isCorrect: true/false (whether the answer is essentially correct)
- score: 0 or 1 (1 if correct, 0 if wrong)
- feedback: brief explanation in English (1-2 sentences)

Questions:
${input.answers.map((a, i) => `
${i + 1}. [Q${a.questionId}] Type: ${a.questionType}
   Question: ${a.questionText}
   Student's Answer: ${a.userAnswer || '(no answer)'}
   Expected Answer: ${a.correctAnswer}
`).join('\n')}

Respond in JSON format:
{
  "results": [
    { "questionId": <number>, "isCorrect": <boolean>, "score": <0|1>, "feedback": "<string>" }
  ]
}`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: "You are a fair and encouraging English teacher. Grade answers based on meaning, not exact wording. Always respond with valid JSON." },
              { role: "user", content: prompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "reading_grading",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    results: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          questionId: { type: "number" },
                          isCorrect: { type: "boolean" },
                          score: { type: "number" },
                          feedback: { type: "string" },
                        },
                        required: ["questionId", "isCorrect", "score", "feedback"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["results"],
                  additionalProperties: false,
                },
              },
            },
          });

          const content = response.choices[0]?.message?.content;
          if (typeof content === 'string') {
            const parsed = JSON.parse(content);
            return parsed.results as { questionId: number; isCorrect: boolean; score: number; feedback: string }[];
          }
        } catch (err) {
          console.error("AI grading error:", err);
        }

        // Fallback: return empty results
        return input.answers.map(a => ({
          questionId: a.questionId,
          isCorrect: false,
          score: 0,
          feedback: "Unable to grade automatically. Please review manually.",
        }));
      }),

    // AI-powered writing evaluation
    evaluateWriting: publicProcedure
      .input(z.object({
        essay: z.string(),
        topic: z.string(),
        wordCountTarget: z.string(),
      }))
      .mutation(async ({ input }) => {
        if (!input.essay || input.essay.trim().length < 10) {
          return {
            score: 0,
            maxScore: 20,
            grade: 'N/A',
            overallFeedback: 'No essay submitted or essay too short to evaluate.',
            grammarErrors: [],
            suggestions: [],
            correctedEssay: '',
          };
        }

        const prompt = `You are an experienced English teacher evaluating a Grade 6 student's composition.

Topic: ${input.topic}
Target word count: ${input.wordCountTarget}

Student's Essay:
"""
${input.essay}
"""

Please evaluate this essay and provide:
1. A score out of 20 (considering content, language, organization, and vocabulary)
2. A letter grade (A/B/C/D/F)
3. Overall feedback (2-3 sentences, encouraging but honest)
4. A list of grammar/spelling errors found (with line context and correction)
5. 2-3 specific suggestions for improvement
6. A corrected version of the essay (fix grammar and spelling only, keep the student's ideas)

Respond in JSON format.`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: "You are a supportive English teacher who provides constructive feedback. Always respond with valid JSON." },
              { role: "user", content: prompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "writing_evaluation",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    score: { type: "number", description: "Score out of 20" },
                    maxScore: { type: "number", description: "Always 20" },
                    grade: { type: "string", description: "Letter grade A-F" },
                    overallFeedback: { type: "string", description: "2-3 sentences of feedback" },
                    grammarErrors: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          original: { type: "string" },
                          correction: { type: "string" },
                          explanation: { type: "string" },
                        },
                        required: ["original", "correction", "explanation"],
                        additionalProperties: false,
                      },
                    },
                    suggestions: {
                      type: "array",
                      items: { type: "string" },
                    },
                    correctedEssay: { type: "string" },
                  },
                  required: ["score", "maxScore", "grade", "overallFeedback", "grammarErrors", "suggestions", "correctedEssay"],
                  additionalProperties: false,
                },
              },
            },
          });

          const content = response.choices[0]?.message?.content;
          if (typeof content === 'string') {
            return JSON.parse(content) as {
              score: number;
              maxScore: number;
              grade: string;
              overallFeedback: string;
              grammarErrors: { original: string; correction: string; explanation: string }[];
              suggestions: string[];
              correctedEssay: string;
            };
          }
        } catch (err) {
          console.error("AI writing evaluation error:", err);
        }

        return {
          score: 0,
          maxScore: 20,
          grade: 'N/A',
          overallFeedback: 'Unable to evaluate automatically. Please review manually.',
          grammarErrors: [],
          suggestions: [],
          correctedEssay: '',
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
