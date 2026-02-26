import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { z } from "zod";
import { saveTestResult, getAllTestResults, getTestResultById, updateTestResultAI, deleteTestResult } from "./db";
import { paperRouter } from "./paperRouter";

export const appRouter = router({
  system: systemRouter,
  papers: paperRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  grading: router({
    // AI-powered reading comprehension answer checking with bilingual explanations
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
        const prompt = `You are an English teacher grading a student's WIDA English Proficiency Assessment reading comprehension answers. 
For each question below, compare the student's answer with the correct answer. 
The student's answer does NOT need to match word-for-word. Accept answers that convey the same meaning, even if worded differently.
Be lenient with minor spelling errors, but the core meaning must be correct.

For each question, provide:
- isCorrect: true/false (whether the answer is essentially correct)
- score: 0 or 1 (1 if correct, 0 if wrong)
- feedback_en: brief explanation in English (1-2 sentences)
- feedback_cn: brief explanation in Chinese (1-2 sentences)
- explanation_en: a detailed explanation in English (2-4 sentences) that helps the student understand WHY the answer is correct or incorrect
- explanation_cn: the same detailed explanation in Chinese (2-4 sentences)

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
    { "questionId": "<string>", "isCorrect": <boolean>, "score": <0|1>, "feedback_en": "<string>", "feedback_cn": "<string>", "explanation_en": "<string>", "explanation_cn": "<string>" }
  ]
}`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: "You are a fair and encouraging English teacher. Grade answers based on meaning, not exact wording. Provide detailed educational explanations in both English and Chinese. Always respond with valid JSON. The questionId in your response MUST be a string that exactly matches the questionId from the input." },
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
                          feedback_en: { type: "string" },
                          feedback_cn: { type: "string" },
                          explanation_en: { type: "string" },
                          explanation_cn: { type: "string" },
                        },
                        required: ["questionId", "isCorrect", "score", "feedback_en", "feedback_cn", "explanation_en", "explanation_cn"],
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
            return parsed.results as { questionId: string; isCorrect: boolean; score: number; feedback_en: string; feedback_cn: string; explanation_en: string; explanation_cn: string }[];
          }
        } catch (err) {
          console.error("AI grading error:", err);
        }

        return input.answers.map(a => ({
          questionId: a.questionId,
          isCorrect: false,
          score: 0,
          feedback_en: "Unable to grade automatically. Please review manually.",
          feedback_cn: "无法自动评分，请手动检查。",
          explanation_en: "The AI grading service is temporarily unavailable.",
          explanation_cn: "AI评分服务暂时不可用。",
        }));
      }),

    // AI-powered writing evaluation with bilingual inline annotations
    evaluateWriting: publicProcedure
      .input(z.object({
        essay: z.string(),
        topic: z.string(),
        wordCountTarget: z.string(),
      }))
      .mutation(async ({ input }) => {
        if (!input.essay || input.essay.trim().length < 10) {
          return {
            score: 0, maxScore: 20, grade: 'N/A',
            overallFeedback_en: 'No essay submitted or essay too short to evaluate.',
            overallFeedback_cn: '未提交作文或作文太短，无法评估。',
            grammarErrors: [],
            suggestions_en: [], suggestions_cn: [],
            correctedEssay: '', annotatedEssay: '',
          };
        }

        const prompt = `You are an experienced English teacher evaluating a Grade 6 student's composition.

Topic: ${input.topic}
Target word count: ${input.wordCountTarget}

Student's Essay:
"""
${input.essay}
"""

Please evaluate this essay and provide ALL feedback in BOTH English and Chinese:
1. A score out of 20 (considering content, language, organization, and vocabulary)
2. A letter grade (A/B/C/D/F)
3. overallFeedback_en: Overall feedback in English (2-3 sentences)
4. overallFeedback_cn: Overall feedback in Chinese (2-3 sentences)
5. grammarErrors: A list of grammar/spelling errors found (with original text, correction, explanation_en in English, explanation_cn in Chinese)
6. suggestions_en: 2-3 specific suggestions in English
7. suggestions_cn: 2-3 specific suggestions in Chinese
8. correctedEssay: A corrected version of the essay
9. annotatedEssay: The ORIGINAL essay with [[ERROR:original text||corrected text||explanation]] markers. Keep all non-error text exactly as the student wrote it.

Example annotated format:
"I [[ERROR:goed||went||'Goed' is not a word. The past tense of 'go' is 'went'.]] to the park."

Respond in JSON format.`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: "You are a supportive English teacher who provides constructive feedback in both English and Chinese. Mark errors inline using the [[ERROR:original||correction||explanation]] format. Always respond with valid JSON." },
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
                    score: { type: "number" },
                    maxScore: { type: "number" },
                    grade: { type: "string" },
                    overallFeedback_en: { type: "string" },
                    overallFeedback_cn: { type: "string" },
                    grammarErrors: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          original: { type: "string" },
                          correction: { type: "string" },
                          explanation_en: { type: "string" },
                          explanation_cn: { type: "string" },
                        },
                        required: ["original", "correction", "explanation_en", "explanation_cn"],
                        additionalProperties: false,
                      },
                    },
                    suggestions_en: { type: "array", items: { type: "string" } },
                    suggestions_cn: { type: "array", items: { type: "string" } },
                    correctedEssay: { type: "string" },
                    annotatedEssay: { type: "string" },
                  },
                  required: ["score", "maxScore", "grade", "overallFeedback_en", "overallFeedback_cn", "grammarErrors", "suggestions_en", "suggestions_cn", "correctedEssay", "annotatedEssay"],
                  additionalProperties: false,
                },
              },
            },
          });

          const content = response.choices[0]?.message?.content;
          if (typeof content === 'string') {
            return JSON.parse(content);
          }
        } catch (err) {
          console.error("AI writing evaluation error:", err);
        }

        return {
          score: 0, maxScore: 20, grade: 'N/A',
          overallFeedback_en: 'Unable to evaluate automatically.',
          overallFeedback_cn: '无法自动评估，请手动检查。',
          grammarErrors: [],
          suggestions_en: [], suggestions_cn: [],
          correctedEssay: '', annotatedEssay: '',
        };
      }),

    // Generate bilingual explanations for wrong answers
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
        if (input.wrongAnswers.length === 0) return [];

        const prompt = `You are an English teacher providing detailed explanations for a student's wrong answers on a WIDA English Proficiency Assessment.
For each wrong answer, provide explanations in BOTH English and Chinese:
- explanation_en: Why the answer is wrong and why the correct answer is right (English)
- explanation_cn: Same explanation in Chinese
- tip_en: A helpful tip or rule to remember (English)
- tip_cn: Same tip in Chinese

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
    { "questionId": <number>, "explanation_en": "<string>", "explanation_cn": "<string>", "tip_en": "<string>", "tip_cn": "<string>" }
  ]
}`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: "You are a patient and encouraging English teacher. Provide clear, educational explanations in both English and Chinese. Always respond with valid JSON." },
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
                          explanation_en: { type: "string" },
                          explanation_cn: { type: "string" },
                          tip_en: { type: "string" },
                          tip_cn: { type: "string" },
                        },
                        required: ["questionId", "explanation_en", "explanation_cn", "tip_en", "tip_cn"],
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
            return parsed.explanations as { questionId: number; explanation_en: string; explanation_cn: string; tip_en: string; tip_cn: string }[];
          }
        } catch (err) {
          console.error("AI explanation error:", err);
        }

        return input.wrongAnswers.map(a => ({
          questionId: a.questionId,
          explanation_en: "Unable to generate explanation.",
          explanation_cn: "无法生成解释。",
          tip_en: "Review the question carefully.",
          tip_cn: "请仔细复习这道题。",
        }));
      }),

    // Generate bilingual proficiency report
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
        const prompt = `You are an English proficiency assessment expert. Based on the following WIDA English Proficiency Assessment results, generate a brief proficiency report in BOTH English and Chinese.

Overall Results:
- Total Score: ${input.totalScore}/${input.totalPossible} (${input.percentage}%)
- Grade: ${input.grade}
- Total Time: ${Math.floor(input.totalTimeSeconds / 60)} minutes ${input.totalTimeSeconds % 60} seconds

Section Breakdown:
${input.sectionResults.map(s => `- ${s.sectionTitle}: ${s.correct}/${s.total} (${s.timeSeconds > 0 ? `${Math.floor(s.timeSeconds / 60)}m ${s.timeSeconds % 60}s` : 'N/A'})`).join('\n')}


Provide ALL fields in both English and Chinese:
1. languageLevel: CEFR level (A1/A2/B1/B2/C1/C2)
2. summary_en / summary_cn: 2-3 sentence overall assessment
3. strengths_en / strengths_cn: 2-3 specific strengths
4. weaknesses_en / weaknesses_cn: 2-3 areas for improvement
5. recommendations_en / recommendations_cn: 2-3 actionable study recommendations
6. timeAnalysis_en / timeAnalysis_cn: Comment on time management

Respond in JSON format.`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: "You are an English proficiency assessment expert. Provide accurate CEFR level estimates and constructive feedback in both English and Chinese. Always respond with valid JSON." },
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
                    languageLevel: { type: "string" },
                    summary_en: { type: "string" },
                    summary_cn: { type: "string" },
                    strengths_en: { type: "array", items: { type: "string" } },
                    strengths_cn: { type: "array", items: { type: "string" } },
                    weaknesses_en: { type: "array", items: { type: "string" } },
                    weaknesses_cn: { type: "array", items: { type: "string" } },
                    recommendations_en: { type: "array", items: { type: "string" } },
                    recommendations_cn: { type: "array", items: { type: "string" } },
                    timeAnalysis_en: { type: "string" },
                    timeAnalysis_cn: { type: "string" },
                  },
                  required: ["languageLevel", "summary_en", "summary_cn", "strengths_en", "strengths_cn", "weaknesses_en", "weaknesses_cn", "recommendations_en", "recommendations_cn", "timeAnalysis_en", "timeAnalysis_cn"],
                  additionalProperties: false,
                },
              },
            },
          });

          const content = response.choices[0]?.message?.content;
          if (typeof content === 'string') {
            return JSON.parse(content);
          }
        } catch (err) {
          console.error("AI report generation error:", err);
        }

        return {
          languageLevel: 'N/A',
          summary_en: 'Unable to generate report.',
          summary_cn: '无法生成报告。',
          strengths_en: [], strengths_cn: [],
          weaknesses_en: [], weaknesses_cn: [],
          recommendations_en: [], recommendations_cn: [],
          timeAnalysis_en: '', timeAnalysis_cn: '',
        };
      }),
   }),

  // Test results CRUD
  results: router({
    save: publicProcedure
      .input(z.object({
        studentName: z.string(),
        studentGrade: z.string().optional(),
        paperId: z.string(),
        paperTitle: z.string(),
        totalCorrect: z.number(),
        totalQuestions: z.number(),
        totalTimeSeconds: z.number().optional(),
        answersJson: z.string(),
        scoreBySectionJson: z.string().optional(),
        sectionTimingsJson: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await saveTestResult({
          studentName: input.studentName,
          studentGrade: input.studentGrade || null,
          paperId: input.paperId,
          paperTitle: input.paperTitle,
          totalCorrect: input.totalCorrect,
          totalQuestions: input.totalQuestions,
          totalTimeSeconds: input.totalTimeSeconds || null,
          answersJson: input.answersJson,
          scoreBySectionJson: input.scoreBySectionJson || null,
          sectionTimingsJson: input.sectionTimingsJson || null,
        });
        return { id };
      }),

    updateAI: publicProcedure
      .input(z.object({
        id: z.number(),
        readingResultsJson: z.string().optional(),
        writingResultJson: z.string().optional(),
        explanationsJson: z.string().optional(),
        reportJson: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        const cleanUpdates: Record<string, string> = {};
        if (updates.readingResultsJson) cleanUpdates.readingResultsJson = updates.readingResultsJson;
        if (updates.writingResultJson) cleanUpdates.writingResultJson = updates.writingResultJson;
        if (updates.explanationsJson) cleanUpdates.explanationsJson = updates.explanationsJson;
        if (updates.reportJson) cleanUpdates.reportJson = updates.reportJson;
        await updateTestResultAI(id, cleanUpdates);
        return { success: true };
      }),

    list: publicProcedure.query(async () => {
      const results = await getAllTestResults();
      return results.map(r => ({
        id: r.id,
        studentName: r.studentName,
        studentGrade: r.studentGrade,
        paperId: r.paperId,
        paperTitle: r.paperTitle,
        totalCorrect: r.totalCorrect,
        totalQuestions: r.totalQuestions,
        totalTimeSeconds: r.totalTimeSeconds,
        createdAt: r.createdAt,
        hasReport: !!r.reportJson,
        hasReadingResults: !!r.readingResultsJson,
        hasWritingResult: !!r.writingResultJson,
      }));
    }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const result = await getTestResultById(input.id);
        if (!result) return null;
        return result;
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteTestResult(input.id);
        return { success: true };
      }),
  }),
});
export type AppRouter = typeof appRouter;
