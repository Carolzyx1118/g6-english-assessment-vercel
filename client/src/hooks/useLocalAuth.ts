import { trpc } from "@/lib/trpc";
import { useCallback, useMemo } from "react";
import { PAPER_SUBJECT_ORDER, type PaperSubject } from "@/data/papers";

const LOCAL_AUTH_TOKEN_KEY = "local_auth_token";
const SAFE_AUTH_TOKEN_PATTERN = /^[A-Za-z0-9._-]+$/;

export type LocalUser = {
  id: number;
  username: string;
  displayName: string;
  role: 'user' | 'admin';
  allowedSubjects: string[];
};

export function isTeacherAccount(user: LocalUser | null | undefined) {
  if (!user) return false;

  const allowedSubjects = user.allowedSubjects.filter((subject): subject is PaperSubject =>
    PAPER_SUBJECT_ORDER.includes(subject as PaperSubject),
  );

  return PAPER_SUBJECT_ORDER.every((subject) => allowedSubjects.includes(subject));
}

/** Save the auth token to localStorage */
export function saveAuthToken(token: string) {
  try {
    localStorage.setItem(LOCAL_AUTH_TOKEN_KEY, token);
  } catch {
    // localStorage might be unavailable in some browsers
  }
}

/** Get the auth token from localStorage */
export function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_TOKEN_KEY);
    if (!raw) return null;

    const token = raw.trim().replace(/^"|"$/g, "");
    if (!token || !SAFE_AUTH_TOKEN_PATTERN.test(token)) {
      localStorage.removeItem(LOCAL_AUTH_TOKEN_KEY);
      return null;
    }

    return token;
  } catch {
    return null;
  }
}

/** Clear the auth token from localStorage */
export function clearAuthToken() {
  try {
    localStorage.removeItem(LOCAL_AUTH_TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function useLocalAuth() {
  const utils = trpc.useUtils();

  const meQuery = trpc.localAuth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    // Only enable the query if we have a token
    enabled: !!getAuthToken(),
  });

  const logoutMutation = trpc.localAuth.logout.useMutation({
    onSuccess: () => {
      clearAuthToken();
      utils.localAuth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // ignore errors
    } finally {
      clearAuthToken();
      utils.localAuth.me.setData(undefined, null);
      await utils.localAuth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const hasToken = !!getAuthToken();

  const state = useMemo(() => {
    // If there's no token at all, we're definitely not authenticated
    if (!hasToken) {
      return {
        user: null as LocalUser | null,
        loading: false,
        error: null as any,
        isAuthenticated: false,
      };
    }

    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    hasToken,
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  return {
    ...state,
    isTeacher: isTeacherAccount(state.user),
    refresh: () => meQuery.refetch(),
    logout,
  };
}
