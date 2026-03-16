import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { transcribeAudio } from "./_core/voiceTranscription";
import { z } from "zod";
import { saveTestResult, getAllTestResults, getTestResultById, updateTestResultAI, deleteTestResult } from "./db";
import { paperRouter } from "./paperRouter";
import { localAuthRouter } from "./localAuthRouter";
import type {
  AssessmentReportResult,
  SpeakingEvaluationResult,
  SpeakingQuestionEvaluation,
} from "../shared/assessmentReport";

function getLetterGradeFromPercentage(percentage: number) {
  if (percentage >= 90) return "A";
  if (percentage >= 75) return "B";
  if (percentage >= 60) return "C";
  if (percentage >= 40) return "D";
  return "F";
}

function clampScore(value: number, maxScore: number) {
  return Math.max(0, Math.min(maxScore, Math.round(value)));
}

function buildFallbackSpeakingQuestionEvaluation(input: {
  sectionId: string;
  sectionTitle: string;
  questionId: number;
  prompt: string;
  audioUrl: string;
  transcript: string;
  reason_en: string;
  reason_cn: string;
}): SpeakingQuestionEvaluation {
  return {
    sectionId: input.sectionId,
    sectionTitle: input.sectionTitle,
    questionId: input.questionId,
    prompt: input.prompt,
    audioUrl: input.audioUrl,
    transcript: input.transcript,
    score: 0,
    maxScore: 10,
    grade: "N/A",
    feedback_en: input.reason_en,
    feedback_cn: input.reason_cn,
    taskCompletion_en: input.reason_en,
    taskCompletion_cn: input.reason_cn,
    fluency_en: "Fluency could not be evaluated automatically.",
    fluency_cn: "流利度暂时无法自动评估。",
    vocabulary_en: "Vocabulary use could not be evaluated automatically.",
    vocabulary_cn: "词汇使用暂时无法自动评估。",
    grammar_en: "Grammar use could not be evaluated automatically.",
    grammar_cn: "语法使用暂时无法自动评估。",
    pronunciation_en: "Pronunciation could not be judged reliably from the available transcript.",
    pronunciation_cn: "现有转写信息不足，无法可靠判断发音情况。",
    suggestions_en: ["Please review this speaking response manually."],
    suggestions_cn: ["请对这道口语题进行人工复核。"],
  };
}

function buildFallbackSpeakingEvaluation(
  evaluations: SpeakingQuestionEvaluation[]
): SpeakingEvaluationResult {
  const totalPossible = evaluations.reduce((sum, item) => sum + item.maxScore, 0);
  const totalScore = evaluations.reduce((sum, item) => sum + item.score, 0);
  const percentage = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;

  return {
    totalScore,
    totalPossible,
    grade: getLetterGradeFromPercentage(percentage),
    overallFeedback_en:
      evaluations.length > 0
        ? "Speaking responses were processed with limited automatic evidence. Please review the transcript and audio manually."
        : "No speaking responses were submitted.",
    overallFeedback_cn:
      evaluations.length > 0
        ? "口语作答的自动分析证据有限，请结合转写内容和录音进行人工复核。"
        : "未提交口语作答。",
    evaluations,
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
    abilitySnapshot_en: ["More evidence is needed to generate a reliable AI profile."],
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
      input.speakingSummary && input.speakingSummary.evaluations.length > 0
        ? "The report includes speaking transcripts and AI comments, but important speaking judgments should still be reviewed together with the original audio."
        : "Use the question-level review together with the overall section scores to plan the next teaching steps.",
    parentFeedback_cn:
      input.speakingSummary && input.speakingSummary.evaluations.length > 0
        ? "本报告已附上口语转写和 AI 反馈，但口语能力判断仍建议结合原始录音做人工复核。"
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
        const evaluations: SpeakingQuestionEvaluation[] = [];

        for (const response of input.responses) {
          const transcription = await transcribeAudio({
            audioUrl: response.audioUrl,
            language: "en",
            prompt: `Transcribe a student's English speaking assessment response. Prompt: ${response.prompt}`,
          });

          if ("error" in transcription) {
            evaluations.push(
              buildFallbackSpeakingQuestionEvaluation({
                ...response,
                transcript: "",
                reason_en: `Automatic speaking evaluation is unavailable because transcription failed: ${transcription.error}.`,
                reason_cn: `由于转写失败，当前无法自动评估口语：${transcription.error}。`,
              })
            );
            continue;
          }

          const transcript = transcription.text.trim();
          if (!transcript) {
            evaluations.push(
              buildFallbackSpeakingQuestionEvaluation({
                ...response,
                transcript: "",
                reason_en: "No usable speech was transcribed from the recording.",
                reason_cn: "录音中没有成功转写出可用的作答内容。",
              })
            );
            continue;
          }

          try {
            const evaluationPrompt = `You are an experienced PET/KET-style speaking examiner reviewing a student's spoken response.

Important constraints:
- You ONLY have the transcript, not the raw audio.
- Be cautious with pronunciation judgments. If the transcript does not provide enough evidence, state that clearly instead of over-claiming.
- Give concise, constructive feedback in BOTH English and Chinese.

Section: ${response.sectionTitle}
Question ID: ${response.questionId}
Prompt:
${response.prompt}

Transcript:
"""
${transcript}
"""

Score this response out of 10.
Evaluate:
1. taskCompletion_en / taskCompletion_cn
2. fluency_en / fluency_cn
3. vocabulary_en / vocabulary_cn
4. grammar_en / grammar_cn
5. pronunciation_en / pronunciation_cn
6. feedback_en / feedback_cn
7. suggestions_en / suggestions_cn (2-3 items each)

Respond in JSON only.`;

            const evaluationResponse = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content:
                    "You are a fair English speaking examiner. Base your judgment on the transcript only, state uncertainty clearly, and always return valid JSON.",
                },
                { role: "user", content: evaluationPrompt },
              ],
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "speaking_evaluation",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
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
                    },
                    required: [
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
                    ],
                    additionalProperties: false,
                  },
                },
              },
            });

            const content = evaluationResponse.choices[0]?.message?.content;
            if (typeof content === "string") {
              const parsed = JSON.parse(content) as Omit<
                SpeakingQuestionEvaluation,
                "sectionId" | "sectionTitle" | "questionId" | "prompt" | "audioUrl" | "transcript"
              >;

              const maxScore = clampScore(parsed.maxScore || 10, 10) || 10;
              const score = clampScore(parsed.score, maxScore);
              const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

              evaluations.push({
                sectionId: response.sectionId,
                sectionTitle: response.sectionTitle,
                questionId: response.questionId,
                prompt: response.prompt,
                audioUrl: response.audioUrl,
                transcript,
                score,
                maxScore,
                grade: parsed.grade || getLetterGradeFromPercentage(percentage),
                feedback_en: parsed.feedback_en,
                feedback_cn: parsed.feedback_cn,
                taskCompletion_en: parsed.taskCompletion_en,
                taskCompletion_cn: parsed.taskCompletion_cn,
                fluency_en: parsed.fluency_en,
                fluency_cn: parsed.fluency_cn,
                vocabulary_en: parsed.vocabulary_en,
                vocabulary_cn: parsed.vocabulary_cn,
                grammar_en: parsed.grammar_en,
                grammar_cn: parsed.grammar_cn,
                pronunciation_en: parsed.pronunciation_en,
                pronunciation_cn: parsed.pronunciation_cn,
                suggestions_en: parsed.suggestions_en,
                suggestions_cn: parsed.suggestions_cn,
              });
              continue;
            }
          } catch (err) {
            console.error("AI speaking evaluation error:", err);
          }

          evaluations.push(
            buildFallbackSpeakingQuestionEvaluation({
              ...response,
              transcript,
              reason_en: "Automatic speaking analysis could not be completed for this response.",
              reason_cn: "这道口语题当前无法完成自动分析。",
            })
          );
        }

        const totalPossible = evaluations.reduce((sum, item) => sum + item.maxScore, 0);
        const totalScore = evaluations.reduce((sum, item) => sum + item.score, 0);
        const percentage = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;

        if (evaluations.length === 0) {
          return buildFallbackSpeakingEvaluation([]);
        }

        return {
          totalScore,
          totalPossible,
          grade: getLetterGradeFromPercentage(percentage),
          overallFeedback_en: evaluations
            .map((item) => `${item.sectionTitle} Q${item.questionId}: ${item.feedback_en}`)
            .join(" "),
          overallFeedback_cn: evaluations
            .map((item) => `${item.sectionTitle} 第${item.questionId}题：${item.feedback_cn}`)
            .join(" "),
          evaluations,
        } satisfies SpeakingEvaluationResult;
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
        }).optional(),
        speakingSummary: z.object({
          totalScore: z.number(),
          totalPossible: z.number(),
          grade: z.string(),
          overallFeedback_en: z.string(),
          overallFeedback_cn: z.string(),
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
- Feedback EN: ${input.writingSummary.overallFeedback_en || "N/A"}
- Feedback CN: ${input.writingSummary.overallFeedback_cn || "N/A"}
- Suggestions EN: ${(input.writingSummary.suggestions_en || []).join("; ") || "N/A"}
- Suggestions CN: ${(input.writingSummary.suggestions_cn || []).join("；") || "N/A"}
` : ""}

${input.speakingSummary ? `Speaking Summary:
- Score: ${input.speakingSummary.totalScore}/${input.speakingSummary.totalPossible}
- Grade: ${input.speakingSummary.grade}
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
13. speakingEvaluation: repeat the speakingSummary in structured form if speaking data exists; otherwise return null

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
                                  "suggestions_cn"
                                ],
                                additionalProperties: false,
                              },
                            },
                          },
                          required: ["totalScore", "totalPossible", "grade", "overallFeedback_en", "overallFeedback_cn", "evaluations"],
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
