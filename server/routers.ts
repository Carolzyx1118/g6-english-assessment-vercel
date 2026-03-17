import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { z } from "zod";
import { saveTestResult, getAllTestResults, getTestResultById, updateTestResultAI, deleteTestResult } from "./db";
import { paperRouter } from "./paperRouter";
import { localAuthRouter } from "./localAuthRouter";
import type {
  AssessmentReportResult,
  SpeakingEvaluationResult,
  SpeakingQuestionEvaluation,
} from "../shared/assessmentReport";

function buildManualWritingEvaluation(input: {
  essay: string;
  topic: string;
  wordCountTarget: string;
}) {
  const hasEssay = input.essay.trim().length > 0;

  if (!hasEssay) {
    return {
      score: 0,
      maxScore: 0,
      grade: "No Submission",
      overallFeedback_en:
        "No writing response was submitted. This section is left for teacher review and is not included in the automatic score.",
      overallFeedback_cn:
        "本次未提交作文作答。该部分将留给老师人工批改，且不会计入自动分数。",
      grammarErrors: [],
      suggestions_en: [],
      suggestions_cn: [],
      correctedEssay: "",
      annotatedEssay: "",
      reviewMode: "manual" as const,
      manualReviewRequired: false,
    };
  }

  return {
    score: 0,
    maxScore: 0,
    grade: "Manual Review",
    overallFeedback_en:
      "Automatic writing scoring has been turned off for this site. A teacher should review this essay manually for content, language accuracy, organization, and vocabulary. This section is not included in the automatic score.",
    overallFeedback_cn:
      "本网站已关闭作文自动评分。该作文需要老师从内容完成度、语言准确性、结构组织和词汇使用等方面进行人工批改。本部分不会计入自动分数。",
    grammarErrors: [],
    suggestions_en: [
      `Review whether the response fully addresses the prompt: ${input.topic}.`,
      `Check organization, sentence accuracy, and vocabulary against the target length (${input.wordCountTarget}).`,
      "Add a teacher score and comments after manual review.",
    ],
    suggestions_cn: [
      `先检查学生是否完整回应了题目要求：${input.topic}。`,
      `再对照目标字数（${input.wordCountTarget}）检查结构、语法准确性和词汇使用。`,
      "老师人工批改后补充分数和评语。",
    ],
    correctedEssay: "",
    annotatedEssay: "",
    reviewMode: "manual" as const,
    manualReviewRequired: true,
  };
}

function buildManualSpeakingEvaluation(
  responses: Array<{
    sectionId: string;
    sectionTitle: string;
    questionId: number;
    prompt: string;
    audioUrl: string;
  }>
): SpeakingEvaluationResult {
  const evaluations: SpeakingQuestionEvaluation[] = responses.map((response) => ({
    sectionId: response.sectionId,
    sectionTitle: response.sectionTitle,
    questionId: response.questionId,
    prompt: response.prompt,
    audioUrl: response.audioUrl,
    transcript: "",
    score: 0,
    maxScore: 0,
    grade: "Manual Review",
    feedback_en:
      "Automatic speaking scoring has been turned off for this site. The teacher should review the original recording manually for task completion, fluency, vocabulary, grammar, and pronunciation.",
    feedback_cn:
      "本网站已关闭口语自动评分。老师需要结合原始录音，从任务完成度、流利度、词汇、语法和发音等方面进行人工批改。",
    taskCompletion_en: "Teacher review is required for this speaking response.",
    taskCompletion_cn: "这道口语题需要老师人工批改。",
    fluency_en: "Please judge fluency from the original recording.",
    fluency_cn: "请结合原始录音判断流利度。",
    vocabulary_en: "Please review vocabulary use manually.",
    vocabulary_cn: "请人工判断词汇使用情况。",
    grammar_en: "Please review grammar control manually.",
    grammar_cn: "请人工判断语法使用情况。",
    pronunciation_en: "Please review pronunciation from the original audio.",
    pronunciation_cn: "请结合原始录音判断发音情况。",
    suggestions_en: [
      "Listen to the original recording before scoring.",
      "Add a teacher score and comments after manual review.",
    ],
    suggestions_cn: [
      "评分前请先听原始录音。",
      "老师人工批改后补充分数和评语。",
    ],
    reviewMode: "manual",
    manualReviewRequired: true,
  }));

  return {
    totalScore: 0,
    totalPossible: 0,
    grade: "Manual Review",
    overallFeedback_en:
      evaluations.length > 0
        ? "Automatic speaking scoring has been turned off for this site. Teacher review is required for all submitted speaking recordings, and speaking is excluded from the automatic score."
        : "No speaking responses were submitted.",
    overallFeedback_cn:
      evaluations.length > 0
        ? "本网站已关闭口语自动评分。所有已提交的口语录音都需要老师人工批改，且口语部分不会计入自动总分。"
        : "未提交口语作答。",
    evaluations,
    reviewMode: "manual",
    manualReviewRequired: evaluations.length > 0,
  };
}

function buildFallbackAssessmentReport(input: {
  paperTitle: string;
  totalScore: number;
  totalPossible: number;
  percentage: number;
  grade: string;
  sectionResults: Array<{ sectionId: string; sectionTitle: string }>;
  speakingSummary?: SpeakingEvaluationResult;
}): AssessmentReportResult {
  return {
    languageLevel: "N/A",
    summary_en: "Automatic report generation is currently unavailable.",
    summary_cn: "当前无法自动生成完整报告。",
    strengths_en: [],
    strengths_cn: [],
    weaknesses_en: [],
    weaknesses_cn: [],
    recommendations_en: ["Review the section-level results and question details manually."],
    recommendations_cn: ["请结合各部分成绩与逐题记录进行人工复核。"],
    timeAnalysis_en: "Time management analysis is unavailable.",
    timeAnalysis_cn: "当前无法生成时间管理分析。",
    reportTitle_en: "Assessment Feedback Report",
    reportTitle_cn: "测评反馈报告",
    overallSummary_en: `${input.paperTitle} has been completed. The student scored ${input.totalScore}/${input.totalPossible} (${input.percentage}%), with an overall grade of ${input.grade}.`,
    overallSummary_cn: `本次 ${input.paperTitle} 已完成。学生总分为 ${input.totalScore}/${input.totalPossible}（${input.percentage}%），综合等级为 ${input.grade}。`,
    abilitySnapshot_en: ["More evidence is needed to generate a reliable profile."],
    abilitySnapshot_cn: ["当前自动分析证据不足，建议结合人工判断进一步解读。"],
    sectionInsights: input.sectionResults.map((section) => ({
      sectionId: section.sectionId,
      sectionTitle: section.sectionTitle,
      summary_en: "Section analysis is unavailable.",
      summary_cn: "当前无法生成该部分的详细分析。",
    })),
    studyPlan: [
      {
        stage_en: "Stage 1",
        stage_cn: "第一阶段",
        focus_en: "Stabilize the basics",
        focus_cn: "先补基础",
        actions_en: ["Review core vocabulary, grammar, and common mistakes from this test."],
        actions_cn: ["先复习本次测评中暴露出的核心词汇、语法和高频错误。"],
      },
      {
        stage_en: "Stage 2",
        stage_cn: "第二阶段",
        focus_en: "Target the weak sections",
        focus_cn: "再做专项",
        actions_en: ["Practice the weakest section with short focused drills and feedback."],
        actions_cn: ["针对最薄弱的版块做短时专项训练，并及时订正反馈。"],
      },
      {
        stage_en: "Stage 3",
        stage_cn: "第三阶段",
        focus_en: "Return to full papers",
        focus_cn: "最后回整套题",
        actions_en: ["Move back to timed full-paper practice after the basics improve."],
        actions_cn: ["基础稳定后，再逐步回到限时整套题训练。"],
      },
    ],
    parentFeedback_en:
      input.speakingSummary?.manualReviewRequired
        ? "Speaking and writing should be finalized together with the teacher's manual scoring notes before sharing a complete parent conclusion."
        : input.speakingSummary && input.speakingSummary.evaluations.length > 0
        ? "The report includes speaking transcripts and comments, but important speaking judgments should still be reviewed together with the original audio."
        : "Use the question-level review together with the overall section scores to plan the next teaching steps.",
    parentFeedback_cn:
      input.speakingSummary?.manualReviewRequired
        ? "建议先结合老师对口语和写作的人工评分与评语，再形成更完整的家长反馈。"
        : input.speakingSummary && input.speakingSummary.evaluations.length > 0
        ? "本报告已附上口语转写和点评，但口语能力判断仍建议结合原始录音做人工复核。"
        : "建议把逐题记录和各部分成绩结合起来，制定下一阶段的教学重点。",
    speakingEvaluation: input.speakingSummary ?? null,
  };
}

export const appRouter = router({
  system: systemRouter,
  papers: paperRouter,
  localAuth: localAuthRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      (ctx.res as any).clearCookie(COOKIE_NAME, {
        ...cookieOptions,
        maxAge: -1,
      });
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
        return buildManualWritingEvaluation(input);
      }),

    evaluateSpeaking: publicProcedure
      .input(z.object({
        responses: z.array(z.object({
          sectionId: z.string(),
          sectionTitle: z.string(),
          questionId: z.number(),
          prompt: z.string(),
          audioUrl: z.string().url(),
        })).min(1),
      }))
      .mutation(async ({ input }) => {
        return buildManualSpeakingEvaluation(input.responses);
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
        paperTitle: z.string(),
        studentName: z.string().optional(),
        studentGrade: z.string().optional(),
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
        writingSummary: z.object({
          score: z.number(),
          maxScore: z.number(),
          grade: z.string(),
          overallFeedback_en: z.string().optional(),
          overallFeedback_cn: z.string().optional(),
          suggestions_en: z.array(z.string()).optional(),
          suggestions_cn: z.array(z.string()).optional(),
          manualReviewRequired: z.boolean().optional(),
        }).optional(),
        speakingSummary: z.object({
          totalScore: z.number(),
          totalPossible: z.number(),
          grade: z.string(),
          overallFeedback_en: z.string(),
          overallFeedback_cn: z.string(),
          reviewMode: z.enum(["ai", "manual"]).optional(),
          manualReviewRequired: z.boolean().optional(),
          evaluations: z.array(z.object({
            sectionId: z.string(),
            sectionTitle: z.string(),
            questionId: z.number(),
            prompt: z.string(),
            audioUrl: z.string(),
            transcript: z.string(),
            score: z.number(),
            maxScore: z.number(),
            grade: z.string(),
            feedback_en: z.string(),
            feedback_cn: z.string(),
            taskCompletion_en: z.string(),
            taskCompletion_cn: z.string(),
            fluency_en: z.string(),
            fluency_cn: z.string(),
            vocabulary_en: z.string(),
            vocabulary_cn: z.string(),
            grammar_en: z.string(),
            grammar_cn: z.string(),
            pronunciation_en: z.string(),
            pronunciation_cn: z.string(),
            suggestions_en: z.array(z.string()),
            suggestions_cn: z.array(z.string()),
            reviewMode: z.enum(["ai", "manual"]).optional(),
            manualReviewRequired: z.boolean().optional(),
          })),
        }).optional(),
      }))
      .mutation(async ({ input }) => {
        const prompt = `You are an English proficiency assessment expert writing a parent-facing student feedback report.
Follow the tone and structure of a professional English assessment feedback report:
- start with a concise overall summary
- explain the student's current level clearly
- identify strengths and weaknesses based on actual section performance
- provide a three-stage study plan
- finish with a parent-friendly concluding note

Assessment:
- Title: ${input.paperTitle}
- Student: ${input.studentName || "Unknown Student"}${input.studentGrade ? ` (${input.studentGrade})` : ""}

Overall Results:
- Total Score: ${input.totalScore}/${input.totalPossible} (${input.percentage}%)
- Grade: ${input.grade}
- Total Time: ${Math.floor(input.totalTimeSeconds / 60)} minutes ${input.totalTimeSeconds % 60} seconds

Section Breakdown:
${input.sectionResults.map(s => `- ${s.sectionTitle}: ${s.correct}/${s.total} (${s.timeSeconds > 0 ? `${Math.floor(s.timeSeconds / 60)}m ${s.timeSeconds % 60}s` : 'N/A'})`).join('\n')}

${input.writingSummary ? `Writing Summary:
- Score: ${input.writingSummary.score}/${input.writingSummary.maxScore}
- Grade: ${input.writingSummary.grade}
- Manual review required: ${input.writingSummary.manualReviewRequired ? "Yes" : "No"}
- Feedback EN: ${input.writingSummary.overallFeedback_en || "N/A"}
- Feedback CN: ${input.writingSummary.overallFeedback_cn || "N/A"}
- Suggestions EN: ${(input.writingSummary.suggestions_en || []).join("; ") || "N/A"}
- Suggestions CN: ${(input.writingSummary.suggestions_cn || []).join("；") || "N/A"}
` : ""}

${input.speakingSummary ? `Speaking Summary:
- Score: ${input.speakingSummary.totalScore}/${input.speakingSummary.totalPossible}
- Grade: ${input.speakingSummary.grade}
- Manual review required: ${input.speakingSummary.manualReviewRequired ? "Yes" : "No"}
- Overall EN: ${input.speakingSummary.overallFeedback_en}
- Overall CN: ${input.speakingSummary.overallFeedback_cn}
- Question details:
${input.speakingSummary.evaluations.map((item) => `  * ${item.sectionTitle} Q${item.questionId}: ${item.score}/${item.maxScore}; Transcript: ${item.transcript}; EN: ${item.feedback_en}; CN: ${item.feedback_cn}`).join("\n")}
` : ""}

Return ALL fields in BOTH English and Chinese:
1. languageLevel: CEFR-like level (A1/A2/B1/B2/C1/C2 or Pre-A1 if clearly below A1)
2. summary_en / summary_cn: short overall summary
3. strengths_en / strengths_cn: 2-3 specific strengths
4. weaknesses_en / weaknesses_cn: 2-3 specific weaknesses
5. recommendations_en / recommendations_cn: 2-3 actionable recommendations
6. timeAnalysis_en / timeAnalysis_cn: comment on time management
7. reportTitle_en / reportTitle_cn: generic report title, not the raw paper name
8. overallSummary_en / overallSummary_cn: a fuller paragraph aligned with a parent-facing report
9. abilitySnapshot_en / abilitySnapshot_cn: 2-4 short bullet-style observations about the student's current profile
10. sectionInsights: an array with one item per section, each containing sectionId, sectionTitle, summary_en, summary_cn
11. studyPlan: exactly 3 stages, each containing stage_en, stage_cn, focus_en, focus_cn, actions_en, actions_cn
12. parentFeedback_en / parentFeedback_cn: a warm but professional concluding note for parents
13. speakingEvaluation: repeat the speakingSummary in structured form, including reviewMode and manualReviewRequired, if speaking data exists; otherwise return null

Important:
- If the writing summary says manual review is required, do not invent a writing score analysis. State clearly that teacher scoring is still pending and that writing is excluded from the automatic score.
- If the speaking summary says manual review is required, do not invent speaking performance analysis, transcript-based judgments, or teacher scores. State clearly that speaking teacher review is still pending and that speaking is excluded from the automatic score.

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
                    reportTitle_en: { type: "string" },
                    reportTitle_cn: { type: "string" },
                    overallSummary_en: { type: "string" },
                    overallSummary_cn: { type: "string" },
                    abilitySnapshot_en: { type: "array", items: { type: "string" } },
                    abilitySnapshot_cn: { type: "array", items: { type: "string" } },
                    sectionInsights: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          sectionId: { type: "string" },
                          sectionTitle: { type: "string" },
                          summary_en: { type: "string" },
                          summary_cn: { type: "string" },
                        },
                        required: ["sectionId", "sectionTitle", "summary_en", "summary_cn"],
                        additionalProperties: false,
                      },
                    },
                    studyPlan: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          stage_en: { type: "string" },
                          stage_cn: { type: "string" },
                          focus_en: { type: "string" },
                          focus_cn: { type: "string" },
                          actions_en: { type: "array", items: { type: "string" } },
                          actions_cn: { type: "array", items: { type: "string" } },
                        },
                        required: ["stage_en", "stage_cn", "focus_en", "focus_cn", "actions_en", "actions_cn"],
                        additionalProperties: false,
                      },
                    },
                    parentFeedback_en: { type: "string" },
                    parentFeedback_cn: { type: "string" },
                    speakingEvaluation: {
                      anyOf: [
                        { type: "null" },
                        {
                          type: "object",
                          properties: {
                            totalScore: { type: "number" },
                            totalPossible: { type: "number" },
                            grade: { type: "string" },
                            overallFeedback_en: { type: "string" },
                            overallFeedback_cn: { type: "string" },
                            reviewMode: { type: "string" },
                            manualReviewRequired: { type: "boolean" },
                            evaluations: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  sectionId: { type: "string" },
                                  sectionTitle: { type: "string" },
                                  questionId: { type: "number" },
                                  prompt: { type: "string" },
                                  audioUrl: { type: "string" },
                                  transcript: { type: "string" },
                                  score: { type: "number" },
                                  maxScore: { type: "number" },
                                  grade: { type: "string" },
                                  feedback_en: { type: "string" },
                                  feedback_cn: { type: "string" },
                                  taskCompletion_en: { type: "string" },
                                  taskCompletion_cn: { type: "string" },
                                  fluency_en: { type: "string" },
                                  fluency_cn: { type: "string" },
                                  vocabulary_en: { type: "string" },
                                  vocabulary_cn: { type: "string" },
                                  grammar_en: { type: "string" },
                                  grammar_cn: { type: "string" },
                                  pronunciation_en: { type: "string" },
                                  pronunciation_cn: { type: "string" },
                                  suggestions_en: { type: "array", items: { type: "string" } },
                                  suggestions_cn: { type: "array", items: { type: "string" } },
                                  reviewMode: { type: "string" },
                                  manualReviewRequired: { type: "boolean" },
                                },
                                required: [
                                  "sectionId",
                                  "sectionTitle",
                                  "questionId",
                                  "prompt",
                                  "audioUrl",
                                  "transcript",
                                  "score",
                                  "maxScore",
                                  "grade",
                                  "feedback_en",
                                  "feedback_cn",
                                  "taskCompletion_en",
                                  "taskCompletion_cn",
                                  "fluency_en",
                                  "fluency_cn",
                                  "vocabulary_en",
                                  "vocabulary_cn",
                                  "grammar_en",
                                  "grammar_cn",
                                  "pronunciation_en",
                                  "pronunciation_cn",
                                  "suggestions_en",
                                  "suggestions_cn",
                                  "reviewMode",
                                  "manualReviewRequired"
                                ],
                                additionalProperties: false,
                              },
                            },
                          },
                          required: [
                            "totalScore",
                            "totalPossible",
                            "grade",
                            "overallFeedback_en",
                            "overallFeedback_cn",
                            "reviewMode",
                            "manualReviewRequired",
                            "evaluations",
                          ],
                          additionalProperties: false,
                        },
                      ],
                    },
                  },
                  required: [
                    "languageLevel",
                    "summary_en",
                    "summary_cn",
                    "strengths_en",
                    "strengths_cn",
                    "weaknesses_en",
                    "weaknesses_cn",
                    "recommendations_en",
                    "recommendations_cn",
                    "timeAnalysis_en",
                    "timeAnalysis_cn",
                    "reportTitle_en",
                    "reportTitle_cn",
                    "overallSummary_en",
                    "overallSummary_cn",
                    "abilitySnapshot_en",
                    "abilitySnapshot_cn",
                    "sectionInsights",
                    "studyPlan",
                    "parentFeedback_en",
                    "parentFeedback_cn",
                    "speakingEvaluation"
                  ],
                  additionalProperties: false,
                },
              },
            },
          });

          const content = response.choices[0]?.message?.content;
          if (typeof content === 'string') {
            return JSON.parse(content) as AssessmentReportResult;
          }
        } catch (err) {
          console.error("AI report generation error:", err);
        }

        return buildFallbackAssessmentReport({
          paperTitle: input.paperTitle,
          totalScore: input.totalScore,
          totalPossible: input.totalPossible,
          percentage: input.percentage,
          grade: input.grade,
          sectionResults: input.sectionResults,
          speakingSummary: input.speakingSummary,
        });
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
