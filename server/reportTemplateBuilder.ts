import type {
  AssessmentReportResult,
  SpeakingEvaluationResult,
} from "../shared/assessmentReport";

type ReportSectionInput = {
  sectionId: string;
  sectionTitle: string;
  correct: number;
  total: number;
  timeSeconds: number;
};

type WritingSummaryInput = {
  score: number;
  maxScore: number;
  grade: string;
  overallFeedback_en?: string;
  overallFeedback_cn?: string;
  suggestions_en?: string[];
  suggestions_cn?: string[];
  manualReviewRequired?: boolean;
};

export type TemplateReportInput = {
  paperTitle: string;
  studentName?: string;
  studentGrade?: string;
  totalScore: number;
  totalPossible: number;
  percentage: number;
  grade: string;
  totalTimeSeconds: number;
  sectionResults: ReportSectionInput[];
  writingSummary?: WritingSummaryInput;
  speakingSummary?: SpeakingEvaluationResult;
};

type SectionKind =
  | "vocabulary"
  | "grammar"
  | "reading"
  | "listening"
  | "writing"
  | "speaking"
  | "general";

type SectionPerformance = "strong" | "developing" | "weak" | "manual";

type SectionDescriptor = ReportSectionInput & {
  kind: SectionKind;
  percentage: number | null;
  performance: SectionPerformance;
  teacherFeedback_en?: string;
  teacherFeedback_cn?: string;
  teacherSuggestions_en: string[];
  teacherSuggestions_cn: string[];
};

type GradeTemplate = {
  languageLevel: string;
  summary_en: string;
  summary_cn: string;
  overview_en: string;
  overview_cn: string;
  parent_en: string;
  parent_cn: string;
  snapshot_en: string[];
  snapshot_cn: string[];
};

const SECTION_LABELS: Record<SectionKind, { en: string; cn: string }> = {
  vocabulary: { en: "Vocabulary", cn: "词汇" },
  grammar: { en: "Grammar", cn: "语法" },
  reading: { en: "Reading", cn: "阅读" },
  listening: { en: "Listening", cn: "听力" },
  writing: { en: "Writing", cn: "写作" },
  speaking: { en: "Speaking", cn: "口语" },
  general: { en: "Section", cn: "部分" },
};

const GRADE_TEMPLATES: Record<string, GradeTemplate> = {
  A: {
    languageLevel: "B1",
    summary_en: "The student is already performing at a comparatively strong and balanced level for the assessed paper.",
    summary_cn: "学生在本次测评中的整体表现较强，能力发展也相对均衡。",
    overview_en:
      "This paper covered core vocabulary, grammar control, reading, listening, and output-related tasks. The current result suggests that the student already has a solid working foundation and is approaching a stable exam-ready stage, although refinement is still needed in the less consistent sections.",
    overview_cn:
      "本次测评覆盖了词汇、语法、阅读、听力以及输出相关能力。综合结果说明学生目前已经具备较扎实的英语基础，整体接近较稳定的考试应用水平，但在个别不够稳定的板块上仍需继续打磨。",
    parent_en:
      "Overall, this is a strong result. The next step is not to restart from the basics, but to stabilize accuracy, improve output quality, and keep the better sections from slipping.",
    parent_cn:
      "整体来看，这是一个较强的结果。接下来不需要回到最基础的内容重复铺垫，而是要继续稳定正确率、提升输出质量，同时把已经表现较好的板块继续守住。",
    snapshot_en: [
      "The student already shows a solid overall English base.",
      "Stronger input skills should now be converted into more controlled output.",
    ],
    snapshot_cn: [
      "整体英语基础已经比较扎实。",
      "接下来应把较好的输入能力进一步转化为更稳定的输出能力。",
    ],
  },
  B: {
    languageLevel: "A2+",
    summary_en: "The student has a workable foundation and is moving toward a more stable assessment level, but there are still visible gaps between stronger and weaker sections.",
    summary_cn: "学生已经有较明确的英语基础，正在向更稳定的测评水平过渡，但不同板块之间仍然存在明显差距。",
    overview_en:
      "The paper tested both recognition skills and language application. The overall score shows that the student is no longer at a purely beginner stage, but performance is not yet steady enough across all sections. The immediate goal is to strengthen the weaker areas while preserving the sections that are already functioning well.",
    overview_cn:
      "本次测评既考查识别能力，也考查语言运用能力。综合结果说明学生已经不是完全初学阶段，但各部分表现还不够稳定。现阶段最重要的是一边补强薄弱环节，一边守住已经相对较好的部分。",
    parent_en:
      "This result shows clear potential, but progress now depends on focused correction rather than more random practice. If the weaker sections are trained systematically, the student can move upward quite steadily.",
    parent_cn:
      "这个结果说明孩子是有提升潜力的，但后续进步更依赖有针对性的纠正训练，而不是继续随意刷题。只要薄弱板块训练方法清晰，整体水平会比较稳定地往上走。",
    snapshot_en: [
      "The foundation is present, but consistency still needs work.",
      "Some sections are already functioning, while weaker parts still hold the total score back.",
    ],
    snapshot_cn: [
      "基础已经具备，但稳定性仍需加强。",
      "部分板块已经能支撑成绩，薄弱部分仍在明显拉低总分。",
    ],
  },
  C: {
    languageLevel: "A2",
    summary_en: "The student has some English foundation, but the current performance is still uneven and needs more structured reinforcement before it can become stable.",
    summary_cn: "学生目前有一定英语基础，但整体表现仍然不够均衡，需要更系统的强化训练后才能逐步稳定。",
    overview_en:
      "This assessment reflects a student who can handle some familiar language tasks, but whose overall control is still limited once question demands become more integrated. The current stage is best described as having a base to build on, yet still needing structured support in both accuracy and application.",
    overview_cn:
      "这次测评反映出学生在熟悉任务中还能完成部分内容，但一旦题目要求更综合，整体控制能力就会明显下降。也就是说，目前是“有基础可继续往上搭建”，但在准确度和运用能力上都还需要系统支撑的阶段。",
    parent_en:
      "The student is not starting from zero, but the foundation is not yet strong enough to support full-paper performance comfortably. The next phase should focus on rebuilding core patterns and creating more stable habits before increasing difficulty again.",
    parent_cn:
      "孩子并不是零基础，但当前基础还不足以轻松支撑整套题表现。下一阶段更适合先把核心模式重新打牢，建立更稳定的做题和表达习惯，再逐步提升难度。",
    snapshot_en: [
      "There is a workable base, but it is not yet stable enough.",
      "Recognition is usually stronger than flexible language use.",
    ],
    snapshot_cn: [
      "目前有一定基础，但整体稳定性还不够。",
      "识别类能力通常强于灵活运用类能力。",
    ],
  },
  D: {
    languageLevel: "A1",
    summary_en: "The student has not yet reached a stable preparation level for this paper, and the current profile shows a clear need to rebuild the basics before pushing exam-style difficulty further.",
    summary_cn: "学生目前还没有达到这套测评所要求的稳定备考水平，现阶段需要先重建基础，再逐步推进到更完整的考试难度。",
    overview_en:
      "This paper covered core vocabulary, grammar, reading, listening, and output-related tasks. From the overall result, the student is still some distance away from stable, exam-style language use. The current stage is closer to having partial foundations but not yet enough control to manage integrated tasks consistently.",
    overview_cn:
      "本次测评覆盖了词汇、语法、阅读、听力以及输出相关能力。从综合结果来看，学生距离稳定的考试应用能力还有明显差距。当前更接近“有部分基础，但还不足以稳定支撑综合任务”的阶段。",
    parent_en:
      "At this stage, the key is not to rush into more test papers. The student needs a clearer rebuilding process in vocabulary, grammar, reading location skills, and sentence-level output so that later practice becomes meaningful.",
    parent_cn:
      "现阶段最重要的不是继续盲目刷题，而是先把词汇、语法、阅读定位能力以及句子层面的输出能力一步一步补起来，这样后面的训练才会真正有效。",
    snapshot_en: [
      "The present result shows partial knowledge, but not enough stable control.",
      "Input is still more reliable than independent output.",
    ],
    snapshot_cn: [
      "当前结果说明孩子并非完全不会，但稳定控制能力明显不足。",
      "输入能力仍然强于独立输出能力。",
    ],
  },
};

function normalizeGrade(grade: string) {
  return GRADE_TEMPLATES[grade] ? grade : "D";
}

function uniqueNonEmpty(items: Array<string | undefined>) {
  return Array.from(new Set(items.map((item) => (item || "").trim()).filter(Boolean)));
}

function formatSectionList(items: string[], locale: "en" | "cn") {
  if (items.length === 0) return locale === "en" ? "the current paper" : "本次测评";
  if (items.length === 1) return items[0];
  if (locale === "en") {
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  }
  return items.join("、");
}

function getSectionKind(sectionId: string, sectionTitle: string): SectionKind {
  const value = `${sectionId} ${sectionTitle}`.toLowerCase();
  if (value.includes("vocab")) return "vocabulary";
  if (value.includes("grammar")) return "grammar";
  if (value.includes("reading")) return "reading";
  if (value.includes("listening")) return "listening";
  if (value.includes("writing")) return "writing";
  if (value.includes("speaking")) return "speaking";
  return "general";
}

function describeSectionPerformance(section: SectionDescriptor) {
  if (section.performance === "manual") {
    if (section.kind === "writing") {
      return {
        en: "This writing section is currently set to teacher review. Please evaluate task completion, organization, language accuracy, and vocabulary manually before finalizing the full report.",
        cn: "本次写作部分当前设置为老师人工批改。请老师结合任务完成度、结构组织、语言准确性和词汇使用情况进行人工评分后，再最终确定完整报告。",
      };
    }
    if (section.kind === "speaking") {
      return {
        en: "This speaking section is currently set to teacher review. Please listen to the original recording and judge task completion, fluency, vocabulary, grammar, and pronunciation manually.",
        cn: "本次口语部分当前设置为老师人工批改。请老师结合原始录音，对任务完成度、流利度、词汇、语法和发音进行人工判断。",
      };
    }
    return {
      en: "This section requires manual review before the final report is completed.",
      cn: "该部分需要人工复核后才能完成最终报告。",
    };
  }

  const scoreText = `${section.correct}/${section.total}${section.percentage !== null ? ` (${section.percentage}%)` : ""}`;
  const label = SECTION_LABELS[section.kind];
  const scorePrefixEn = `${label.en} scored ${scoreText}. `;
  const scorePrefixCn = `${label.cn}部分本次得分为 ${scoreText}。`;

  const templates: Record<SectionKind, Record<Exclude<SectionPerformance, "manual">, { en: string; cn: string }>> = {
    vocabulary: {
      strong: {
        en: "Vocabulary recognition is comparatively stable. The student can usually identify core meanings in context and should now keep improving collocations and precise word use.",
        cn: "词汇识别整体较稳定，学生通常能够在语境中判断核心词义。下一步应继续强化固定搭配和词语使用的准确性。",
      },
      developing: {
        en: "The student has some vocabulary foundation, but accuracy becomes less stable once collocations, word choice, or sentence context become more demanding.",
        cn: "学生有一定词汇基础，但一旦涉及固定搭配、词义辨析或更复杂语境，正确率就不够稳定。",
      },
      weak: {
        en: "Vocabulary is still a clear weak point. The student needs more support in basic meaning recognition, collocations, and using the right word inside a sentence.",
        cn: "词汇目前仍是比较明显的薄弱环节，需要继续补强基础词义识别、固定搭配以及把单词准确放进句子里的能力。",
      },
    },
    grammar: {
      strong: {
        en: "Grammar control is relatively solid in this paper. The student is already showing a workable sense of structure, though accuracy should still be monitored in more demanding sentence forms.",
        cn: "语法部分整体较稳，学生已经表现出一定的句子结构感。后续仍需继续关注更复杂句型中的准确度。",
      },
      developing: {
        en: "Grammar is functioning at a basic level, but errors still appear when tense, sentence pattern, or transformation demands increase. This section still needs structured consolidation.",
        cn: "语法目前能支撑部分基础题目，但一旦时态、句型结构或改写要求提高，错误就会明显增多，因此仍需要系统巩固。",
      },
      weak: {
        en: "Grammar is one of the clearest weak points in the current profile. The student needs step-by-step rebuilding in tense control, sentence structure, and pattern-based accuracy.",
        cn: "语法是当前最明显的薄弱板块之一，孩子需要围绕时态、句型结构和句子准确性做一步一步的重建训练。",
      },
    },
    reading: {
      strong: {
        en: "Reading comprehension is comparatively stable. The student can usually locate useful information and make workable matches between question demands and the text.",
        cn: "阅读理解整体相对稳定，学生通常能够找到关键信息，并较好地把题目要求和文本内容对应起来。",
      },
      developing: {
        en: "Reading is workable, but the student is not yet fully stable when multiple conditions need to be compared together. Information selection and detail matching should be trained further.",
        cn: "阅读目前具备一定基础，但一旦需要同时比对多个条件时，整体稳定性仍然不足。后续应继续强化信息筛选和细节匹配能力。",
      },
      weak: {
        en: "Reading is currently weak, especially in locating key evidence, combining details, and checking whether all question conditions are satisfied.",
        cn: "阅读目前偏弱，主要问题集中在关键信息定位、细节整合，以及是否完整满足题干条件这几个方面。",
      },
    },
    listening: {
      strong: {
        en: "Listening is currently one of the better-performing sections. The student can usually catch the main message and several direct details from familiar speech.",
        cn: "听力是当前表现较好的板块之一，孩子通常能抓住主要信息，也能听出一部分较直接的细节。",
      },
      developing: {
        en: "Listening is at a usable level, but detail capture is not yet consistent enough when distractors or quick turns appear. More keyword-based practice will help.",
        cn: "听力目前具备一定可用性，但一旦出现干扰信息或转折，细节抓取还不够稳定。继续做关键词训练会比较有效。",
      },
      weak: {
        en: "Listening still needs clear support, especially in identifying key information quickly and resisting distractors.",
        cn: "听力仍需要较明确的强化，尤其是在快速抓取关键信息和排除干扰选项这两个方面。",
      },
    },
    writing: {
      strong: {
        en: "Writing shows workable control for the current task, though further polishing in organization and accuracy would still make the output stronger.",
        cn: "写作在本次任务中已经表现出一定控制力，但如果继续打磨结构组织和语言准确性，整体输出会更扎实。",
      },
      developing: {
        en: "Writing is at a developing stage. The student can produce some relevant content, but organization, sentence control, and support details still need to become more stable.",
        cn: "写作目前处于发展阶段，学生能够写出部分相关内容，但结构组织、句子控制和细节展开仍需进一步稳定。",
      },
      weak: {
        en: "Writing is still weak and needs more support from sentence building, paragraph structure, and basic language accuracy.",
        cn: "写作目前仍较薄弱，需要从句子搭建、段落结构和基础语言准确性几个方面继续补强。",
      },
    },
    speaking: {
      strong: {
        en: "Speaking shows a workable level of task response and oral control, although more flexible language and fuller development would still strengthen the performance.",
        cn: "口语已经表现出一定的任务回应能力和口头控制力，但如果表达更灵活、展开更充分，整体表现还会更强。",
      },
      developing: {
        en: "Speaking is developing, but the student still needs more stable fluency, clearer response logic, and a wider range of useful spoken expressions.",
        cn: "口语正在发展中，但流利度、回应逻辑以及常用口语表达的稳定性仍需继续提升。",
      },
      weak: {
        en: "Speaking remains weak at the moment, especially in sustained response, organization, and controlled oral output.",
        cn: "口语目前仍然偏弱，主要问题集中在持续表达、逻辑组织以及较稳定的口头输出能力上。",
      },
    },
    general: {
      strong: {
        en: "This section is currently functioning well and can be maintained while the weaker areas are strengthened.",
        cn: "这一部分目前表现较稳，在继续补强薄弱板块的同时，也要把这部分维持住。",
      },
      developing: {
        en: "This section shows some workable ability, but overall stability still needs to be improved.",
        cn: "这一部分已经有一定能力基础，但整体稳定性仍需继续提升。",
      },
      weak: {
        en: "This section still needs more direct support before it can become a stable scoring area.",
        cn: "这一部分仍需要更直接的强化，之后才有机会逐步变成稳定得分点。",
      },
    },
  };

  const nextSteps: Record<SectionKind, Record<Exclude<SectionPerformance, "manual">, { en: string; cn: string }>> = {
    vocabulary: {
      strong: {
        en: "The next step is to move from knowing the word to using it more precisely inside sentence context and common collocations.",
        cn: "下一步应从“认识单词”继续走向“在句子和固定搭配中把词用准”。",
      },
      developing: {
        en: "The next step should focus on repeated review of high-frequency collocations and common meaning distinctions, so that accuracy stops dropping when contexts become slightly harder.",
        cn: "下一步建议围绕高频搭配和常见词义辨析反复巩固，避免语境一变复杂就明显失分。",
      },
      weak: {
        en: "The current priority is to rebuild high-frequency word meaning, collocations, and the habit of checking whether a word really fits the sentence.",
        cn: "当前优先任务是重新补强高频词义、固定搭配，以及“这个词放进句子里是否真的合适”的判断习惯。",
      },
    },
    grammar: {
      strong: {
        en: "The next step is to keep grammar accurate in longer sentences, transformations, and more integrated task settings.",
        cn: "下一步要把这种稳定性继续延伸到更长句、改写题和更综合的任务里。",
      },
      developing: {
        en: "The next step should focus on repeated correction of tense, sentence pattern, and transformation mistakes until the correct form becomes more automatic.",
        cn: "下一步应把时态、句型和改写类错误反复纠正，直到正确表达逐渐变成更自动化的反应。",
      },
      weak: {
        en: "The current goal is not to cover more grammar points quickly, but to rebuild a smaller group of high-frequency structures until they are stable.",
        cn: "当前重点不是一下子铺更多语法点，而是先把一小批高频结构真正练稳。",
      },
    },
    reading: {
      strong: {
        en: "The next step is to make this section faster and more reliable by reducing unnecessary hesitation and double-checking.",
        cn: "下一步应继续减少无效犹豫和重复检查，让这一板块既保持正确率，也提升速度。",
      },
      developing: {
        en: "The next step should focus on locating key evidence more directly and checking every condition in the question before finalizing an answer.",
        cn: "下一步应重点训练更直接地定位证据，并在作答前完整核对题干里的每一个条件。",
      },
      weak: {
        en: "The immediate priority is to rebuild reading location skills, condition matching, and the habit of proving the answer from the text instead of relying on guesses.",
        cn: "当前最需要先补的是阅读定位、条件匹配，以及“答案必须能从原文找到依据”的做题习惯。",
      },
    },
    listening: {
      strong: {
        en: "The next step is to maintain listening stability while improving response speed to detail and distractors.",
        cn: "下一步要在保持听力稳定性的同时，继续提升对细节和干扰项的反应速度。",
      },
      developing: {
        en: "The next step should focus on keywords, signal words, and quick note-taking habits so that details are not lost once the audio moves faster.",
        cn: "下一步应围绕关键词、信号词和快速抓点习惯训练，避免语速一快就漏掉细节。",
      },
      weak: {
        en: "The current goal is to reduce panic during listening by building shorter, highly guided drills around key information and distractor control.",
        cn: "当前应先通过更短、更有引导性的训练，帮助孩子在听力中建立抓关键信息和排除干扰的基本控制力。",
      },
    },
    writing: {
      strong: {
        en: "The next step is to keep ideas better supported and make sentence control more consistent across the whole response.",
        cn: "下一步要继续把观点支撑写得更充分，并让整篇表达的句子控制更稳定。",
      },
      developing: {
        en: "The next step should focus on clearer paragraphing, fuller support details, and reducing avoidable sentence-level errors.",
        cn: "下一步建议重点加强段落组织、细节展开，以及减少本可避免的句子层面错误。",
      },
      weak: {
        en: "The current priority is to move from short disconnected ideas toward basic sentence control and clearer paragraph structure.",
        cn: "当前优先任务是先从零散短句逐步过渡到基本句子控制和更清楚的段落结构。",
      },
    },
    speaking: {
      strong: {
        en: "The next step is to keep fluency while making answers more fully developed and more flexible in expression.",
        cn: "下一步要在保持流利度的同时，让回答展开得更充分、表达更灵活。",
      },
      developing: {
        en: "The next step should focus on steadier fluency, clearer response logic, and using a more reusable set of spoken expressions.",
        cn: "下一步建议继续提升流利度稳定性、回应逻辑，以及一批可反复使用的常用口语表达。",
      },
      weak: {
        en: "The current priority is to build short but complete spoken responses first, rather than aiming for long answers too early.",
        cn: "当前更重要的是先建立“短但完整”的口头回应能力，而不是过早追求很长的回答。",
      },
    },
    general: {
      strong: {
        en: "The next step is to protect this section as a stable scoring area while other parts are being improved.",
        cn: "下一步要把这一部分继续守成稳定得分点，同时为其他板块补弱争取空间。",
      },
      developing: {
        en: "The next step is to turn a workable performance into a more repeatable and dependable one.",
        cn: "下一步就是把“基本可用”的表现继续拉到更可重复、更可靠的水平。",
      },
      weak: {
        en: "The current priority is to reduce avoidable basic errors before raising the task difficulty again.",
        cn: "当前最重要的是先减少基础性失误，再逐步重新提高任务难度。",
      },
    },
  };

  const teacherFeedbackEn = section.teacherFeedback_en
    ? `Teacher feedback noted: ${section.teacherFeedback_en.replace(/\s+/g, " ").trim()}`
    : "";
  const teacherFeedbackCn = section.teacherFeedback_cn
    ? `老师本次批改中提到：${section.teacherFeedback_cn.replace(/\s+/g, " ").trim()}`
    : "";
  const suggestionEn = section.teacherSuggestions_en.length > 0
    ? `Follow-up practice can focus on: ${section.teacherSuggestions_en.slice(0, 2).join("; ")}.`
    : "";
  const suggestionCn = section.teacherSuggestions_cn.length > 0
    ? `后续练习可优先围绕：${section.teacherSuggestions_cn.slice(0, 2).join("；")}。`
    : "";

  return {
    en: [
      scorePrefixEn,
      templates[section.kind][section.performance].en,
      nextSteps[section.kind][section.performance].en,
      teacherFeedbackEn,
      suggestionEn,
    ]
      .filter(Boolean)
      .join(" "),
    cn: [
      scorePrefixCn,
      templates[section.kind][section.performance].cn,
      nextSteps[section.kind][section.performance].cn,
      teacherFeedbackCn,
      suggestionCn,
    ]
      .filter(Boolean)
      .join(""),
  };
}

function buildSectionDescriptors(input: TemplateReportInput) {
  return input.sectionResults.map((section) => {
    const kind = getSectionKind(section.sectionId, section.sectionTitle);
    const manual =
      (kind === "writing" && input.writingSummary?.manualReviewRequired) ||
      (kind === "speaking" && input.speakingSummary?.manualReviewRequired);
    const percentage = !manual && section.total > 0 ? Math.round((section.correct / section.total) * 100) : null;
    const performance: SectionPerformance = manual
      ? "manual"
      : percentage === null
      ? "weak"
      : percentage >= 75
      ? "strong"
      : percentage >= 50
      ? "developing"
      : "weak";

    const writingSuggestionsEn = input.writingSummary?.suggestions_en ?? [];
    const writingSuggestionsCn = input.writingSummary?.suggestions_cn ?? [];
    const speakingEvaluations = input.speakingSummary?.evaluations.filter(
      (item) => item.sectionId === section.sectionId,
    ) ?? [];
    const speakingFeedbackEn = uniqueNonEmpty([
      speakingEvaluations.length > 0 ? input.speakingSummary?.overallFeedback_en : undefined,
      ...speakingEvaluations.map((item) => item.feedback_en),
    ]).join(" ");
    const speakingFeedbackCn = uniqueNonEmpty([
      speakingEvaluations.length > 0 ? input.speakingSummary?.overallFeedback_cn : undefined,
      ...speakingEvaluations.map((item) => item.feedback_cn),
    ]).join("");
    const speakingSuggestionsEn = uniqueNonEmpty(
      speakingEvaluations.flatMap((item) => item.suggestions_en ?? []),
    );
    const speakingSuggestionsCn = uniqueNonEmpty(
      speakingEvaluations.flatMap((item) => item.suggestions_cn ?? []),
    );

    return {
      ...section,
      kind,
      percentage,
      performance,
      teacherFeedback_en:
        kind === "writing"
          ? input.writingSummary?.overallFeedback_en
          : kind === "speaking"
          ? speakingFeedbackEn
          : undefined,
      teacherFeedback_cn:
        kind === "writing"
          ? input.writingSummary?.overallFeedback_cn
          : kind === "speaking"
          ? speakingFeedbackCn
          : undefined,
      teacherSuggestions_en:
        kind === "writing"
          ? writingSuggestionsEn
          : kind === "speaking"
          ? speakingSuggestionsEn
          : [],
      teacherSuggestions_cn:
        kind === "writing"
          ? writingSuggestionsCn
          : kind === "speaking"
          ? speakingSuggestionsCn
          : [],
    } satisfies SectionDescriptor;
  });
}

function pickStrongWeakSections(sections: SectionDescriptor[]) {
  const scoredSections = sections.filter((section) => section.performance !== "manual" && section.percentage !== null);
  const sorted = [...scoredSections].sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
  return {
    strongest: sorted[0],
    weakest: sorted[sorted.length - 1],
    weakSections: scoredSections
      .filter((section) => section.performance === "weak")
      .sort((a, b) => (a.percentage || 0) - (b.percentage || 0)),
  };
}

function buildAbilitySnapshot(grade: string, sections: SectionDescriptor[]) {
  const template = GRADE_TEMPLATES[grade];
  const { strongest, weakest } = pickStrongWeakSections(sections);
  const snapshotsEn = [...template.snapshot_en];
  const snapshotsCn = [...template.snapshot_cn];

  if (strongest) {
    snapshotsEn.push(`Current stronger area: ${strongest.sectionTitle}.`);
    snapshotsCn.push(`当前相对较好的板块是：${strongest.sectionTitle}。`);
  }

  if (weakest) {
    snapshotsEn.push(`Current priority area: ${weakest.sectionTitle}.`);
    snapshotsCn.push(`当前最需要优先提升的板块是：${weakest.sectionTitle}。`);
  }

  const manualKinds = sections.filter((section) => section.performance === "manual").map((section) => section.kind);
  const manualReviewEn = "Writing and speaking should be finalized together with teacher review.";
  const manualReviewCn = "写作和口语需要结合老师人工批改后再做完整判断。";
  if (manualKinds.includes("writing") || manualKinds.includes("speaking")) {
    snapshotsEn.push(manualReviewEn);
    snapshotsCn.push(manualReviewCn);
  }

  const uniqueEn = Array.from(new Set(snapshotsEn));
  const uniqueCn = Array.from(new Set(snapshotsCn));
  const includeManual = manualKinds.includes("writing") || manualKinds.includes("speaking");

  if (includeManual && uniqueEn.length > 4 && !uniqueEn.slice(0, 4).includes(manualReviewEn)) {
    uniqueEn.splice(3, 1, manualReviewEn);
  }
  if (includeManual && uniqueCn.length > 4 && !uniqueCn.slice(0, 4).includes(manualReviewCn)) {
    uniqueCn.splice(3, 1, manualReviewCn);
  }

  return {
    en: uniqueEn.slice(0, 4),
    cn: uniqueCn.slice(0, 4),
  };
}

function buildStrengthsWeaknesses(sections: SectionDescriptor[]) {
  const strengthsEn: string[] = [];
  const strengthsCn: string[] = [];
  const weaknessesEn: string[] = [];
  const weaknessesCn: string[] = [];

  const strengthTemplates: Record<SectionKind, { en: string; cn: string }> = {
    vocabulary: {
      en: "Vocabulary is currently giving the student a relatively dependable scoring base, which suggests that core word recognition is becoming more stable.",
      cn: "词汇目前能够提供相对稳定的得分基础，说明孩子在核心词义识别上已经开始形成较明确的把握。",
    },
    grammar: {
      en: "Grammar is showing a comparatively clearer structure sense, which helps the student control basic sentence forms more reliably.",
      cn: "语法部分已经表现出相对更清楚的结构感，这说明孩子在基础句型控制上开始变得更可靠。",
    },
    reading: {
      en: "Reading is currently one of the more usable sections, showing that the student can already find and connect some key evidence from the text.",
      cn: "阅读目前是相对更可用的板块之一，说明孩子已经能够从文本中找到并连接一部分关键信息。",
    },
    listening: {
      en: "Listening is helping support the total profile, which means the student can still catch a useful amount of main information and direct detail.",
      cn: "听力目前能为整体成绩提供支撑，说明孩子仍能抓住相当一部分主信息和较直接的细节。",
    },
    writing: {
      en: "Writing has started to show some workable output control, which is a useful sign for later improvement in organization and expression.",
      cn: "写作已经开始表现出一定可用的输出控制力，这对后续继续提升结构和表达是一个积极信号。",
    },
    speaking: {
      en: "Speaking shows some workable oral response ability, which means the student is not starting from zero in output tasks.",
      cn: "口语已经表现出一定可用的口头回应能力，说明孩子在输出任务上并不是完全从零开始。",
    },
    general: {
      en: "One or more sections are already beginning to function as dependable scoring areas.",
      cn: "当前已经有部分板块开始具备较稳定的得分能力。",
    },
  };

  const weaknessTemplates: Record<SectionKind, { en: string; cn: string }> = {
    vocabulary: {
      en: "Vocabulary accuracy is still unstable once the task moves beyond direct word meaning and asks for collocation or context-sensitive choice.",
      cn: "词汇一旦从直接词义判断走向搭配或语境辨析，准确性就会明显下降，说明这一板块仍需继续补稳。",
    },
    grammar: {
      en: "Grammar mistakes are still affecting overall control, especially when the task requires sentence transformation or more precise structure use.",
      cn: "语法错误仍在明显影响整体控制力，尤其是改写和更精确的句型使用时，失分会更集中地暴露出来。",
    },
    reading: {
      en: "Reading is still losing points through incomplete evidence checking, which suggests that question conditions are not yet being tracked carefully enough.",
      cn: "阅读目前仍会因为证据核对不完整而失分，说明孩子对题干条件的追踪还不够细致稳定。",
    },
    listening: {
      en: "Listening is still vulnerable to distractors and missed details, so this section cannot yet be treated as a stable scoring area.",
      cn: "听力目前仍容易被干扰项和细节遗漏拉低成绩，因此还不能算真正稳定的得分板块。",
    },
    writing: {
      en: "Writing still needs clearer structure, more controlled sentence building, and better idea support before it can become a reliable output section.",
      cn: "写作要想变成稳定得分板块，还需要继续加强结构组织、句子控制和观点支撑这三个方面。",
    },
    speaking: {
      en: "Speaking still needs more stable response logic and more controlled oral output before the student can handle this section confidently.",
      cn: "口语要想更有把握地完成任务，仍需要先把回应逻辑和较稳定的口头输出能力补起来。",
    },
    general: {
      en: "The weaker sections are still reducing the overall profile and therefore need more direct correction than the stronger parts.",
      cn: "薄弱板块仍在明显拉低整体画像，因此需要比优势部分更直接、更聚焦的纠正训练。",
    },
  };

  sections.forEach((section) => {
    if (section.performance === "strong") {
      strengthsEn.push(`${section.sectionTitle}: ${strengthTemplates[section.kind].en}`);
      strengthsCn.push(`${section.sectionTitle}：${strengthTemplates[section.kind].cn}`);
    }
    if (section.performance === "weak") {
      weaknessesEn.push(`${section.sectionTitle}: ${weaknessTemplates[section.kind].en}`);
      weaknessesCn.push(`${section.sectionTitle}：${weaknessTemplates[section.kind].cn}`);
    }
  });

  if (strengthsEn.length === 0) {
    strengthsEn.push("The student is still building a clearer set of reliable strengths.");
    strengthsCn.push("孩子目前还在建立更稳定的优势板块。");
  }

  if (weaknessesEn.length === 0) {
    weaknessesEn.push("The current profile is relatively even, so improvement can now focus on refinement.");
    weaknessesCn.push("当前整体能力相对均衡，后续提升可以更多放在细节打磨上。");
  }

  return {
    strengths_en: strengthsEn.slice(0, 3),
    strengths_cn: strengthsCn.slice(0, 3),
    weaknesses_en: weaknessesEn.slice(0, 3),
    weaknesses_cn: weaknessesCn.slice(0, 3),
  };
}

function buildRecommendations(grade: string, sections: SectionDescriptor[]) {
  const { weakSections } = pickStrongWeakSections(sections);
  const weakTitles = weakSections.slice(0, 2).map((section) => section.sectionTitle);
  const manualTitles = sections
    .filter((section) => section.performance === "manual")
    .map((section) => section.sectionTitle);

  const gradeDefaults: Record<string, { en: string[]; cn: string[] }> = {
    A: {
      en: [
        "Keep full-paper practice regular so that strong sections remain stable under time pressure.",
        "Use teacher feedback from writing and speaking to refine output quality and flexibility.",
        "Push weaker sections from 'good enough' to genuinely reliable by reviewing errors promptly.",
      ],
      cn: [
        "继续保持整套题训练，确保较强板块在限时状态下也能稳定发挥。",
        "结合老师对写作和口语的反馈，继续提升输出质量和表达灵活度。",
        "把相对薄弱的板块从“基本可用”继续提升到真正稳定可靠。",
      ],
    },
    B: {
      en: [
        "Stabilize the weaker sections before increasing overall practice volume.",
        "Use targeted correction to reduce repeated errors instead of only doing more questions.",
        "Keep stronger sections active so that they can support the total score while weaker parts improve.",
      ],
      cn: [
        "先把薄弱板块稳定下来，再逐步增加整体练习量。",
        "后续训练应重视针对性纠错，而不是只靠增加做题数量。",
        "在补弱的同时也要继续维持优势板块，避免原本能得分的部分下滑。",
      ],
    },
    C: {
      en: [
        "Return to core vocabulary, grammar, and sentence-level practice before pushing harder papers.",
        "Break weak sections into smaller drills so that the student can build accuracy step by step.",
        "Use teacher-reviewed writing and speaking work to connect input skills with output practice.",
      ],
      cn: [
        "在做更难题目前，先回到核心词汇、语法和句子层面的基础训练。",
        "把薄弱板块拆成更小的专项任务，一步一步建立准确度。",
        "结合老师批改过的写作和口语练习，把输入能力逐步转化为输出能力。",
      ],
    },
    D: {
      en: [
        "Do not rush into more full papers yet; rebuild the core basics first.",
        "Train vocabulary, grammar, reading location, and sentence output in a clearer sequence.",
        "Use small-step practice with immediate correction so that the student can rebuild confidence and control.",
      ],
      cn: [
        "现阶段不要急着继续做大量整套题，先把基础重新补起来更重要。",
        "后续训练应按词汇、语法、阅读定位、句子输出这样更清晰的顺序推进。",
        "建议采用“小步训练 + 及时订正”的方式，帮助孩子逐步重建信心和控制力。",
      ],
    },
  };

  const defaults = gradeDefaults[grade] || gradeDefaults.D;
  if (weakTitles.length > 0) {
    defaults.en[0] = `Start with focused work on ${weakTitles.join(" and ")} before expanding practice volume again.`;
    defaults.cn[0] = `建议先围绕 ${weakTitles.join(" 和 ")} 做针对性训练，再逐步扩大练习量。`;
  }
  if (manualTitles.length > 0) {
    defaults.en[2] = `Use teacher-reviewed work from ${formatSectionList(manualTitles, "en")} to connect input practice with clearer output routines.`;
    defaults.cn[2] = `把 ${formatSectionList(manualTitles, "cn")} 的老师批改结果真正用起来，帮助孩子把输入训练逐步转化为更清楚的输出套路。`;
  }

  return {
    recommendations_en: defaults.en,
    recommendations_cn: defaults.cn,
  };
}

function buildParentFeedback(grade: string, sections: SectionDescriptor[]) {
  const template = GRADE_TEMPLATES[grade];
  const { strongest, weakest, weakSections } = pickStrongWeakSections(sections);
  const weakTitles = weakSections.slice(0, 2).map((section) => section.sectionTitle);
  const longest = [...sections].sort((a, b) => b.timeSeconds - a.timeSeconds)[0];
  const manualTitles = sections
    .filter((section) => section.performance === "manual")
    .map((section) => section.sectionTitle);

  const followUpEn = weakTitles.length > 0
    ? `In the short term, home support should stay centered on ${formatSectionList(weakTitles, "en")} instead of spreading practice too widely at once.`
    : "In the short term, practice should stay focused and consistent instead of becoming too broad or random.";
  const followUpCn = weakTitles.length > 0
    ? `短期内，家庭配合的重点应继续放在 ${formatSectionList(weakTitles, "cn")} 上，而不是把练习面一下子铺得过宽。`
    : "短期内，家庭配合更适合保持聚焦和持续，而不是把练习内容一下子铺得太散。";

  const balanceEn = strongest
    ? `${strongest.sectionTitle} can currently serve as a confidence-supporting area, so it should be maintained while weaker sections are being repaired.`
    : "It will be important to protect whichever section is currently more stable, so that confidence is not lost during the rebuilding process.";
  const balanceCn = strongest
    ? `${strongest.sectionTitle} 目前可以作为帮助孩子建立信心的支撑板块，因此在补弱过程中也要继续维持。`
    : "在补弱过程中，也要继续维持相对更稳的部分，避免孩子在重建阶段失去信心。";

  const timingEn = longest && longest.timeSeconds > 0
    ? `Because ${longest.sectionTitle} took the longest time in this paper, parents can also watch whether hesitation, repeated checking, or output pressure is slowing the student down there.`
    : "Parents can also pay attention to whether hesitation and repeated checking are affecting the student’s pace during practice.";
  const timingCn = longest && longest.timeSeconds > 0
    ? `另外，本次 ${longest.sectionTitle} 耗时相对更长，家长也可以关注孩子在这一部分是否存在犹豫、反复检查或表达压力偏大的情况。`
    : "另外，家长也可以关注孩子在练习时是否存在犹豫过多、反复检查等影响节奏的问题。";

  const manualEn = manualTitles.length > 0
    ? `For ${formatSectionList(manualTitles, "en")}, teacher scoring comments should be treated as core follow-up guidance rather than as one-off remarks.`
    : "";
  const manualCn = manualTitles.length > 0
    ? `${formatSectionList(manualTitles, "cn")} 这部分的老师评分和评语，建议当作后续训练的重要依据，而不是只看一次就结束。`
    : "";

  return {
    en: [template.parent_en, followUpEn, balanceEn, manualEn, timingEn].filter(Boolean).join(" "),
    cn: [template.parent_cn, followUpCn, balanceCn, manualCn, timingCn].filter(Boolean).join(""),
  };
}

function buildStudyPlan(grade: string, sections: SectionDescriptor[]) {
  const manualOutput = sections.some((section) => section.kind === "writing" || section.kind === "speaking") &&
    sections.some((section) => section.performance === "manual");

  const plans: Record<string, AssessmentReportResult["studyPlan"]> = {
    A: [
      {
        stage_en: "Stage 1",
        stage_cn: "第一阶段",
        focus_en: "Keep the stronger sections stable",
        focus_cn: "先稳住优势板块",
        actions_en: [
          "Review mistakes from each paper immediately and keep an error log.",
          "Maintain vocabulary, reading, and listening with short but regular timed practice.",
        ],
        actions_cn: [
          "每次做题后及时整理错题，建立持续复盘的错误清单。",
          "通过短时但规律的限时练习，继续维持词汇、阅读和听力的稳定性。",
        ],
      },
      {
        stage_en: "Stage 2",
        stage_cn: "第二阶段",
        focus_en: "Polish output quality",
        focus_cn: "再打磨输出质量",
        actions_en: manualOutput
          ? [
              "Use teacher-marked writing and speaking work to improve organization and expression.",
              "Practice expanding ideas more fully instead of giving short safe answers.",
            ]
          : [
              "Refine writing and speaking with better organization, detail support, and expression variety.",
              "Practice expanding ideas more fully instead of giving short safe answers.",
            ],
        actions_cn: manualOutput
          ? [
              "结合老师批改过的写作和口语作业，继续优化结构和表达质量。",
              "训练把观点展开得更充分，而不是只停留在较短、较安全的回答层面。",
            ]
          : [
              "继续打磨写作和口语的结构组织、细节支撑和表达丰富度。",
              "训练把观点展开得更充分，而不是只停留在较短、较安全的回答层面。",
            ],
      },
      {
        stage_en: "Stage 3",
        stage_cn: "第三阶段",
        focus_en: "Timed full-paper refinement",
        focus_cn: "最后做整套题打磨",
        actions_en: [
          "Use timed full papers to keep accuracy and speed aligned.",
          "Treat each full paper as refinement work rather than first-time exposure.",
        ],
        actions_cn: [
          "通过限时整套题训练，把正确率和时间控制继续统一起来。",
          "后续整套题应以“打磨与稳定”为主，而不是第一次接触型练习。",
        ],
      },
    ],
    B: [
      {
        stage_en: "Stage 1",
        stage_cn: "第一阶段",
        focus_en: "Stabilize the basics",
        focus_cn: "先稳基础",
        actions_en: [
          "Review the weaker sections with targeted correction instead of broad mixed practice.",
          "Keep daily review on high-frequency vocabulary, grammar patterns, and common question traps.",
        ],
        actions_cn: [
          "先对薄弱板块做针对性纠正训练，而不是一开始就大量混合练习。",
          "每天维持高频词汇、核心语法和常见失分点的复习。",
        ],
      },
      {
        stage_en: "Stage 2",
        stage_cn: "第二阶段",
        focus_en: "Target the weaker sections",
        focus_cn: "再做专项补弱",
        actions_en: [
          "Use reading, grammar, and vocabulary drills to improve stability before returning to full papers.",
          manualOutput ? "Use teacher-reviewed writing and speaking tasks to build clearer output routines." : "Strengthen output tasks with clearer sentence patterns and better response logic.",
        ],
        actions_cn: [
          "先通过阅读、语法、词汇专项提高稳定性，再回到整套题训练。",
          manualOutput ? "结合老师批改过的写作和口语任务，建立更清晰的输出套路。" : "继续加强输出题目的句型结构和回应逻辑。",
        ],
      },
      {
        stage_en: "Stage 3",
        stage_cn: "第三阶段",
        focus_en: "Return to full papers",
        focus_cn: "最后回整套题",
        actions_en: [
          "Use timed mixed practice to check whether corrected weaknesses remain stable.",
          "Keep one review cycle after each paper so that old mistakes do not repeat.",
        ],
        actions_cn: [
          "回到限时整套题，检查补弱后的板块能否真正稳定下来。",
          "每做完一套题都要保留一次系统复盘，避免旧错误反复出现。",
        ],
      },
    ],
    C: [
      {
        stage_en: "Stage 1",
        stage_cn: "第一阶段",
        focus_en: "Rebuild the core basics",
        focus_cn: "先补核心基础",
        actions_en: [
          "Return to high-frequency vocabulary, tense control, and sentence pattern review.",
          "Reduce task difficulty temporarily so that accuracy can be rebuilt step by step.",
        ],
        actions_cn: [
          "先回到高频词汇、核心时态和基础句型的重建训练。",
          "阶段性降低任务难度，先把准确度一步一步补回来。",
        ],
      },
      {
        stage_en: "Stage 2",
        stage_cn: "第二阶段",
        focus_en: "Do focused section drills",
        focus_cn: "再做专项练习",
        actions_en: [
          "Break weak sections into smaller skills such as locating details, matching conditions, and controlled sentence output.",
          manualOutput ? "Use teacher-reviewed writing and speaking tasks as guided output practice." : "Keep output practice short and structured rather than asking for long free production too early.",
        ],
        actions_cn: [
          "把薄弱板块拆成更小的技能训练，例如细节定位、条件匹配和受控句子输出。",
          manualOutput ? "把老师批改过的写作和口语任务当作带引导的输出训练材料。" : "输出训练先保持短而有结构，不要过早追求长篇自由表达。",
        ],
      },
      {
        stage_en: "Stage 3",
        stage_cn: "第三阶段",
        focus_en: "Return to mixed papers gradually",
        focus_cn: "最后逐步回整套题",
        actions_en: [
          "Move back to mixed papers only after the weaker sections stop collapsing under pressure.",
          "Keep review after every practice so that gains are not lost.",
        ],
        actions_cn: [
          "只有在薄弱板块不再明显失控后，再逐步回到混合题和整套题训练。",
          "每次练习后都要配套复盘，避免刚建立起来的进步被快速消耗掉。",
        ],
      },
    ],
    D: [
      {
        stage_en: "Stage 1",
        stage_cn: "第一阶段",
        focus_en: "Rebuild the foundation",
        focus_cn: "先重建基础",
        actions_en: [
          "Return to basic vocabulary meaning, high-frequency grammar, and short sentence patterns.",
          "Use easier practice so the student can rebuild control before facing harder paper tasks again.",
        ],
        actions_cn: [
          "先回到基础词义、高频语法和短句型训练，重新建立最基本的控制力。",
          "先用更容易的练习材料重建准确度，再重新面对更难的整卷任务。",
        ],
      },
      {
        stage_en: "Stage 2",
        stage_cn: "第二阶段",
        focus_en: "Build section-level habits",
        focus_cn: "再建立专项习惯",
        actions_en: [
          "Train one section at a time, especially vocabulary, grammar, and reading location skills.",
          manualOutput ? "Use teacher-guided writing and speaking correction to build simple output routines." : "Keep output practice limited to guided sentence and short-response tasks at first.",
        ],
        actions_cn: [
          "专项训练时一次只抓一个板块，尤其是词汇、语法和阅读定位能力。",
          manualOutput ? "结合老师的写作和口语批改，先建立最基本的输出表达套路。" : "输出训练先从带引导的句子和短回答开始，不要急着做复杂开放题。",
        ],
      },
      {
        stage_en: "Stage 3",
        stage_cn: "第三阶段",
        focus_en: "Return to exam-style work slowly",
        focus_cn: "最后慢慢回考试训练",
        actions_en: [
          "Reintroduce mixed assessment tasks only after the basic error rate has come down.",
          "Use short review cycles and visible progress tracking to protect confidence.",
        ],
        actions_cn: [
          "只有在基础错误率明显下降后，再慢慢回到混合题和考试型训练。",
          "通过短周期复盘和可视化进步记录，帮助孩子稳住信心。",
        ],
      },
    ],
  };

  return plans[grade] || plans.D;
}

function buildTimeAnalysis(totalTimeSeconds: number, sections: SectionDescriptor[]) {
  if (totalTimeSeconds <= 0) {
    return {
      en: "Time data was not recorded for this assessment.",
      cn: "本次测评未记录有效用时数据。",
    };
  }

  const longest = [...sections].sort((a, b) => b.timeSeconds - a.timeSeconds)[0];
  const totalMinutes = Math.floor(totalTimeSeconds / 60);
  const totalSeconds = totalTimeSeconds % 60;

  if (!longest || longest.timeSeconds <= 0) {
    return {
      en: `The full assessment took ${totalMinutes} minutes ${totalSeconds} seconds. More section-level timing evidence will make later time analysis more reliable.`,
      cn: `本次整套测评总用时 ${totalMinutes} 分 ${totalSeconds} 秒。若后续继续记录各部分时间，时间分析会更准确。`,
    };
  }

  return {
    en: `The full assessment took ${totalMinutes} minutes ${totalSeconds} seconds. The section that took the longest was ${longest.sectionTitle}, so later practice should also monitor whether extra time is being spent because of hesitation, slow checking, or output pressure.`,
    cn: `本次整套测评总用时 ${totalMinutes} 分 ${totalSeconds} 秒。其中耗时最长的是 ${longest.sectionTitle}，后续训练中可以继续观察这部分是否存在犹豫、反复检查或输出速度偏慢的问题。`,
  };
}

export function buildTemplateAssessmentReport(input: TemplateReportInput): AssessmentReportResult {
  const grade = normalizeGrade(input.grade);
  const template = GRADE_TEMPLATES[grade];
  const sections = buildSectionDescriptors(input);
  const abilitySnapshot = buildAbilitySnapshot(grade, sections);
  const { strongest, weakest } = pickStrongWeakSections(sections);
  const sectionInsights = sections.map((section) => {
    const summary = describeSectionPerformance(section);
    return {
      sectionId: section.sectionId,
      sectionTitle: section.sectionTitle,
      summary_en: summary.en,
      summary_cn: summary.cn,
    };
  });
  const strengthsWeaknesses = buildStrengthsWeaknesses(sections);
  const recommendations = buildRecommendations(grade, sections);
  const timeAnalysis = buildTimeAnalysis(input.totalTimeSeconds, sections);
  const parentFeedback = buildParentFeedback(grade, sections);

  const overallSummaryEn = [
    `${input.paperTitle} has been completed for ${input.studentName || "the student"}${input.studentGrade ? ` (${input.studentGrade})` : ""}.`,
    `The student scored ${input.totalScore}/${input.totalPossible} (${input.percentage}%), with an overall grade of ${grade}.`,
    template.summary_en,
    template.overview_en,
    strongest ? `At the moment, ${strongest.sectionTitle} is functioning as the clearest relative strength in the paper.` : "",
    weakest ? `${weakest.sectionTitle} is currently the section that needs the earliest and most focused correction.` : "",
    input.writingSummary?.manualReviewRequired || input.speakingSummary?.manualReviewRequired
      ? "Writing and speaking should be finalized together with teacher scoring notes, so the current automatic total should be read as a partial academic profile rather than the final full-skill judgment."
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const overallSummaryCn = [
    `${input.paperTitle} 已完成测评。${input.studentName ? `学生为 ${input.studentName}` : "本次结果对应的学生"}${input.studentGrade ? `，年级为 ${input.studentGrade}` : ""}。`,
    `本次总分为 ${input.totalScore}/${input.totalPossible}（${input.percentage}%），综合等级为 ${grade}。`,
    template.summary_cn,
    template.overview_cn,
    strongest ? `从分项结果看，${strongest.sectionTitle} 是目前相对更能支撑成绩的板块。` : "",
    weakest ? `${weakest.sectionTitle} 则是接下来最需要优先处理的薄弱点。` : "",
    input.writingSummary?.manualReviewRequired || input.speakingSummary?.manualReviewRequired
      ? "由于写作和口语仍需老师人工评分，当前自动总分应理解为阶段性学业画像，而不是最终完整能力结论。"
      : "",
  ]
    .filter(Boolean)
    .join("");

  return {
    languageLevel: template.languageLevel,
    summary_en: template.summary_en,
    summary_cn: template.summary_cn,
    ...strengthsWeaknesses,
    ...recommendations,
    timeAnalysis_en: timeAnalysis.en,
    timeAnalysis_cn: timeAnalysis.cn,
    reportTitle_en: "Assessment Feedback Report",
    reportTitle_cn: "测评反馈报告",
    overallSummary_en: overallSummaryEn,
    overallSummary_cn: overallSummaryCn,
    abilitySnapshot_en: abilitySnapshot.en,
    abilitySnapshot_cn: abilitySnapshot.cn,
    sectionInsights,
    studyPlan: buildStudyPlan(grade, sections),
    parentFeedback_en: parentFeedback.en,
    parentFeedback_cn: parentFeedback.cn,
    speakingEvaluation: input.speakingSummary ?? null,
  };
}
