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
    // AI-powered reading comprehension answer checking with detailed explanations
    // Now accepts string questionId to support sub-question IDs like "33-a", "33-b"
    checkReadingAnswers: publicProcedure
      .input(z.object({
        answers: z.array(z.object({
          questionId: z.string(),
          questionType: z.string(),
          questionText: z.string(),
          userAnswer: z.string(),
          correctAnswer: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        const prompt = `You are an English teacher grading a G6 (Grade 6) student's reading comprehension answers. 
For each question below, compare the student's answer with the correct answer. 
The student's answer does NOT need to match word-for-word. Accept answers that convey the same meaning, even if worded differently.
Be lenient with minor spelling errors, but the core meaning must be correct.

For each question, provide:
- isCorrect: true/false (whether the answer is essentially correct)
- score: 0 or 1 (1 if correct, 0 if wrong)
- feedback: brief explanation in English (1-2 sentences)
- explanation: a detailed explanation (2-4 sentences) that helps the student understand WHY the answer is correct or incorrect. Reference the passage content and explain the reasoning. This should be educational and help the student learn.

Questions:
${input.answers.map((a, i) => `
${i + 1}. [${a.questionId}] Type: ${a.questionType}
   Question: ${a.questionText}
   Student's Answer: ${a.userAnswer || '(no answer)'}
   Expected Answer: ${a.correctAnswer}
`).join('\n')}

Respond in JSON format:
{
  "results": [
    { "questionId": "<string matching the question ID above>", "isCorrect": <boolean>, "score": <0|1>, "feedback": "<string>", "explanation": "<string>" }
  ]
}`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: "You are a fair and encouraging English teacher. Grade answers based on meaning, not exact wording. Provide detailed educational explanations. Always respond with valid JSON. The questionId in your response MUST be a string that exactly matches the questionId from the input." },
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
                          questionId: { type: "string" },
                          isCorrect: { type: "boolean" },
                          score: { type: "number" },
                          feedback: { type: "string" },
                          explanation: { type: "string" },
                        },
                        required: ["questionId", "isCorrect", "score", "feedback", "explanation"],
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
            return parsed.results as { questionId: string; isCorrect: boolean; score: number; feedback: string; explanation: string }[];
          }
        } catch (err) {
          console.error("AI grading error:", err);
        }

        return input.answers.map(a => ({
          questionId: a.questionId,
          isCorrect: false,
          score: 0,
          feedback: "Unable to grade automatically. Please review manually.",
          explanation: "The AI grading service is temporarily unavailable. Please check your answer against the expected answer manually.",
        }));
      }),

    // AI-powered writing evaluation with inline annotations
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
            annotatedEssay: '',
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
4. A list of grammar/spelling errors found (with the exact original text, correction, and explanation)
5. 2-3 specific suggestions for improvement
6. A corrected version of the essay (fix grammar and spelling only, keep the student's ideas)
7. An annotated version of the ORIGINAL essay where each error is marked with [[ERROR:original text||corrected text||explanation]]. Keep all non-error text exactly as the student wrote it. This allows us to show inline annotations on the original text.

Example of annotated essay format:
"I [[ERROR:goed||went||'Goed' is not a word. The past tense of 'go' is 'went'.]] to the park and [[ERROR:seen||saw||Use 'saw' (past simple) instead of 'seen' (past participle).]] a beautiful bird."

Respond in JSON format.`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: "You are a supportive English teacher who provides constructive feedback. Mark errors inline using the [[ERROR:original||correction||explanation]] format. Always respond with valid JSON." },
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
                    annotatedEssay: { type: "string", description: "Original essay with [[ERROR:original||correction||explanation]] markers" },
                  },
                  required: ["score", "maxScore", "grade", "overallFeedback", "grammarErrors", "suggestions", "correctedEssay", "annotatedEssay"],
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
              annotatedEssay: string;
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
          annotatedEssay: '',
        };
      }),

    // Generate detailed explanations for wrong answers in auto-graded sections
    explainWrongAnswers: publicProcedure
      .input(z.object({
        wrongAnswers: z.array(z.object({
          questionId: z.number(),
          sectionType: z.string(),
          questionText: z.string(),
          userAnswer: z.string(),
          correctAnswer: z.string(),
          context: z.string().optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        if (input.wrongAnswers.length === 0) {
          return [];
        }

        const prompt = `You are an English teacher providing detailed explanations for a G6 student's wrong answers.
For each wrong answer below, provide a clear, educational explanation that helps the student understand:
- Why their answer is wrong
- Why the correct answer is right
- A helpful tip or rule to remember

Questions:
${input.wrongAnswers.map((a, i) => `
${i + 1}. [Q${a.questionId}] Section: ${a.sectionType}
   Question: ${a.questionText}
   ${a.context ? `Context: ${a.context}` : ''}
   Student's Answer: ${a.userAnswer}
   Correct Answer: ${a.correctAnswer}
`).join('\n')}

Respond in JSON format:
{
  "explanations": [
    { "questionId": <number>, "explanation": "<detailed explanation 2-4 sentences>", "tip": "<a short memorable tip or rule>" }
  ]
}`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: "You are a patient and encouraging English teacher. Provide clear, educational explanations that help students learn. Always respond with valid JSON." },
              { role: "user", content: prompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "answer_explanations",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    explanations: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          questionId: { type: "number" },
                          explanation: { type: "string" },
                          tip: { type: "string" },
                        },
                        required: ["questionId", "explanation", "tip"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["explanations"],
                  additionalProperties: false,
                },
              },
            },
          });

          const content = response.choices[0]?.message?.content;
          if (typeof content === 'string') {
            const parsed = JSON.parse(content);
            return parsed.explanations as { questionId: number; explanation: string; tip: string }[];
          }
        } catch (err) {
          console.error("AI explanation error:", err);
        }

        return input.wrongAnswers.map(a => ({
          questionId: a.questionId,
          explanation: "Unable to generate explanation. Please review the correct answer and compare with yours.",
          tip: "Review the question carefully and try to understand the context.",
        }));
      }),

    // Generate proficiency report
    generateReport: publicProcedure
      .input(z.object({
        totalScore: z.number(),
        totalPossible: z.number(),
        percentage: z.number(),
        grade: z.string(),
        totalTimeSeconds: z.number(),
        sectionResults: z.array(z.object({
          sectionId: z.string(),
          sectionTitle: z.string(),
          correct: z.number(),
          total: z.number(),
          timeSeconds: z.number(),
        })),
        writingScore: z.number().optional(),
        writingMaxScore: z.number().optional(),
        writingGrade: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const prompt = `You are an English proficiency assessment expert. Based on the following test results for a Grade 6 student, generate a brief proficiency report.

Overall Results:
- Total Score: ${input.totalScore}/${input.totalPossible} (${input.percentage}%)
- Grade: ${input.grade}
- Total Time: ${Math.floor(input.totalTimeSeconds / 60)} minutes ${input.totalTimeSeconds % 60} seconds

Section Breakdown:
${input.sectionResults.map(s => `- ${s.sectionTitle}: ${s.correct}/${s.total} (${s.timeSeconds > 0 ? `${Math.floor(s.timeSeconds / 60)}m ${s.timeSeconds % 60}s` : 'N/A'})`).join('\n')}
${input.writingScore !== undefined ? `- Writing: ${input.writingScore}/${input.writingMaxScore} (Grade: ${input.writingGrade})` : ''}

Please generate a proficiency report with:
1. languageLevel: CEFR level estimate (A1/A2/B1/B2/C1/C2) based on performance
2. summary: A brief 2-3 sentence overall assessment
3. strengths: 2-3 specific strengths observed
4. weaknesses: 2-3 specific areas for improvement
5. recommendations: 2-3 actionable study recommendations
6. timeAnalysis: Brief comment on time management (was the student too fast/slow/appropriate for each section?)

Respond in JSON format.`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: "You are an English proficiency assessment expert. Provide accurate CEFR level estimates and constructive feedback. Always respond with valid JSON." },
              { role: "user", content: prompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "proficiency_report",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    languageLevel: { type: "string", description: "CEFR level A1-C2" },
                    summary: { type: "string" },
                    strengths: { type: "array", items: { type: "string" } },
                    weaknesses: { type: "array", items: { type: "string" } },
                    recommendations: { type: "array", items: { type: "string" } },
                    timeAnalysis: { type: "string" },
                  },
                  required: ["languageLevel", "summary", "strengths", "weaknesses", "recommendations", "timeAnalysis"],
                  additionalProperties: false,
                },
              },
            },
          });

          const content = response.choices[0]?.message?.content;
          if (typeof content === 'string') {
            return JSON.parse(content) as {
              languageLevel: string;
              summary: string;
              strengths: string[];
              weaknesses: string[];
              recommendations: string[];
              timeAnalysis: string;
            };
          }
        } catch (err) {
          console.error("AI report generation error:", err);
        }

        return {
          languageLevel: 'N/A',
          summary: 'Unable to generate report. Please try again.',
          strengths: [],
          weaknesses: [],
          recommendations: [],
          timeAnalysis: '',
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
