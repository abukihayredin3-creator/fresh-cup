import { ApiError } from "@fresh-cup/api-client";
import type { AuthTokens, User } from "@fresh-cup/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

async function readStorage(): Promise<StoredAuth | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  } catch {
    return null;
  }
}

async function writeStorage(auth: StoredAuth | null): Promise<void> {
  if (auth) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  } else {
    await AsyncStorage.removeItem(STORAGE_KEY);
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
    void writeStorage({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: tokens.user,
    });

    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
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
    void writeStorage(null);
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
    let cancelled = false;
    readStorage()
      .then(async (stored) => {
        if (cancelled) return;
        if (stored) {
          setAccessToken(stored.accessToken);
          setAccessTokenState(stored.accessToken);
          setUserState(stored.user);
          refreshTokenRef.current = stored.refreshToken;
          await doRefreshRef.current();
        }
      })
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });
    return () => {
      cancelled = true;
    };
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
    void readStorage().then((stored) => {
      if (stored) void writeStorage({ ...stored, user: next });
    });
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
