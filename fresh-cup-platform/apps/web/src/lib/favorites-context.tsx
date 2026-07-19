"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "fresh-cup-favorites";

interface FavoritesContextValue {
  favoriteIds: string[];
  isFavorite: (menuItemId: string) => boolean;
  toggleFavorite: (menuItemId: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

function readStorage(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * The backend has no favorites endpoint (Phases 1-3 never added one), and adding one here
 * would mean building new backend logic — out of scope. Favorites are therefore a per-device
 * preference, persisted to localStorage only.
 */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  useEffect(() => {
    // localStorage is unavailable during SSR; hydrated post-mount.
    // eslint-disable-next-line -- see comment above
    setFavoriteIds(readStorage());
  }, []);

  const toggleFavorite = useCallback((menuItemId: string) => {
    setFavoriteIds((current) => {
      const next = current.includes(menuItemId)
        ? current.filter((id) => id !== menuItemId)
        : [...current, menuItemId];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (menuItemId: string) => favoriteIds.includes(menuItemId),
    [favoriteIds],
  );

  const value = useMemo(
    () => ({ favoriteIds, isFavorite, toggleFavorite }),
    [favoriteIds, isFavorite, toggleFavorite],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return context;
}
