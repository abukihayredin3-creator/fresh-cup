import AsyncStorage from "@react-native-async-storage/async-storage";
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

/** No backend favorites endpoint exists (see the web app's favorites-context.tsx for why) —
 * a per-device preference, persisted to AsyncStorage only. */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setFavoriteIds(JSON.parse(raw) as string[]);
      })
      .catch(() => {});
  }, []);

  const toggleFavorite = useCallback((menuItemId: string) => {
    setFavoriteIds((current) => {
      const next = current.includes(menuItemId)
        ? current.filter((id) => id !== menuItemId)
        : [...current, menuItemId];
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
