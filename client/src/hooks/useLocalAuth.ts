import { trpc } from "@/lib/trpc";
import { useCallback, useMemo } from "react";

const LOCAL_AUTH_TOKEN_KEY = "local_auth_token";

export type LocalUser = {
  id: number;
  username: string;
  displayName: string;
  role: string;
};

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
    return localStorage.getItem(LOCAL_AUTH_TOKEN_KEY);
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
    refresh: () => meQuery.refetch(),
    logout,
  };
}
