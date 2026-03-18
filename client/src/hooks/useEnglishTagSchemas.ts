import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  ENGLISH_EXAM_TAG_SCHEMAS,
  englishTagSystemsToMap,
  getDefaultEnglishExamTagTrack,
  getEnglishExamTagEntries,
} from "@shared/englishQuestionTags";

export function useEnglishTagSchemas() {
  const query = trpc.papers.getEnglishTagSystems.useQuery(undefined, {
    staleTime: 30_000,
  });

  const schemas = useMemo(() => {
    if (!query.data || query.data.length === 0) {
      return ENGLISH_EXAM_TAG_SCHEMAS;
    }
    return englishTagSystemsToMap(query.data);
  }, [query.data]);

  const schemaEntries = useMemo(() => getEnglishExamTagEntries(schemas), [schemas]);
  const defaultTrack = useMemo(() => getDefaultEnglishExamTagTrack(schemas), [schemas]);

  return {
    ...query,
    schemas,
    schemaEntries,
    defaultTrack,
  };
}
