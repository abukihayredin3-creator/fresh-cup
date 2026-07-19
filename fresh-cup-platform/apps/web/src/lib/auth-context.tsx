"use client";

import { ApiError } from "@fresh-cup/api-client";
import type { AuthTokens, User } from "@fresh-cup/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, setAccessToken } from "./api-client";

const STORAGE_KEY = "fresh-cup-auth";

interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  user: User;
}

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isReady: boolean;
  requestOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  staffLogin: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStorage(): StoredAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  } catch {
    return null;
  }
}

function writeStorage(auth: StoredAuth | null): void {
  if (typeof window === "undefined") return;
  if (auth) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const refreshTokenRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Breaks the mutual recursion between applyTokens and doRefresh (each schedules/calls the
  // other) without forward-referencing a not-yet-declared binding.
  const doRefreshRef = useRef<() => Promise<void>>(async () => {});

  const applyTokens = useCallback((tokens: AuthTokens) => {
    setAccessToken(tokens.accessToken);
    setAccessTokenState(tokens.accessToken);
    setUserState(tokens.user);
    refreshTokenRef.current = tokens.refreshToken;
    writeStorage({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: tokens.user,
    });

    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    // Refresh a minute before expiry rather than waiting for a 401.
    const delayMs = Math.max((tokens.expiresIn - 60) * 1000, 10_000);
    refreshTimerRef.current = setTimeout(() => {
      void doRefreshRef.current();
    }, delayMs);
  }, []);

  const clearAuth = useCallback(() => {
    setAccessToken(null);
    setAccessTokenState(null);
    setUserState(null);
    refreshTokenRef.current = null;
    writeStorage(null);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  const doRefresh = useCallback(async () => {
    const refreshToken = refreshTokenRef.current;
    if (!refreshToken) return;
    try {
      const tokens = await api.auth.refresh({ refreshToken });
      applyTokens(tokens);
    } catch {
      clearAuth();
    }
  }, [applyTokens, clearAuth]);

  useEffect(() => {
    doRefreshRef.current = doRefresh;
  }, [doRefresh]);

  useEffect(() => {
    // Reads localStorage post-mount (unavailable during SSR) — the server-rendered markup
    // always starts logged out, and is reconciled to the stored session here.
    const stored = readStorage();
    if (stored) {
      setAccessToken(stored.accessToken);
      // eslint-disable-next-line -- see comment above
      setAccessTokenState(stored.accessToken);
      setUserState(stored.user);
      refreshTokenRef.current = stored.refreshToken;
      // Kick off a refresh immediately — we don't know how stale the stored token is.
      void doRefreshRef.current();
    }
    setIsReady(true);
  }, []);

  const requestOtp = useCallback(async (phone: string) => {
    await api.auth.requestOtp({ phone });
  }, []);

  const verifyOtp = useCallback(
    async (phone: string, code: string) => {
      const tokens = await api.auth.verifyOtp({ phone, code });
      applyTokens(tokens);
    },
    [applyTokens],
  );

  const staffLogin = useCallback(
    async (email: string, password: string) => {
      const tokens = await api.auth.staffLogin({ email, password });
      applyTokens(tokens);
    },
    [applyTokens],
  );

  const logout = useCallback(async () => {
    const refreshToken = refreshTokenRef.current;
    clearAuth();
    if (refreshToken) {
      try {
        await api.auth.logout({ refreshToken });
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
      }
    }
  }, [clearAuth]);

  const setUser = useCallback((next: User) => {
    setUserState(next);
    const stored = readStorage();
    if (stored) writeStorage({ ...stored, user: next });
  }, []);

  const value = useMemo(
    () => ({ user, accessToken, isReady, requestOtp, verifyOtp, staffLogin, logout, setUser }),
    [user, accessToken, isReady, requestOtp, verifyOtp, staffLogin, logout, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
