import { trpc } from "@/lib/trpc";
import type { PaperSubject } from "@/data/papers";

export function useSubjectTagSystems(subject: PaperSubject) {
  const englishQuery = trpc.papers.getEnglishTagSystems.useQuery(undefined, {
    enabled: subject === "english",
    staleTime: 30_000,
  });
  const mathQuery = trpc.papers.getMathTagSystems.useQuery(undefined, {
    enabled: subject === "math",
    staleTime: 30_000,
  });
  const vocabularyQuery = trpc.papers.getVocabularyTagSystems.useQuery(undefined, {
    enabled: subject === "vocabulary",
    staleTime: 30_000,
  });

  if (subject === "english") {
    return {
      ...englishQuery,
      systems: englishQuery.data ?? [],
    };
  }

  if (subject === "math") {
    return {
      ...mathQuery,
      systems: mathQuery.data ?? [],
    };
  }

  return {
    ...vocabularyQuery,
    systems: vocabularyQuery.data ?? [],
  };
}
