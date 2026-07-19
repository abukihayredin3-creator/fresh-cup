import type { Branch } from "@fresh-cup/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api-client";

const STORAGE_KEY = "fresh-cup-branch-id";

interface BranchContextValue {
  branches: Branch[];
  branchId: string | null;
  branch: Branch | null;
  isLoading: boolean;
  setBranchId: (id: string) => void;
}

const BranchContext = createContext<BranchContextValue | null>(null);

export function BranchProvider({ children }: { children: ReactNode }) {
  const [branchId, setBranchIdState] = useState<string | null>(null);

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.catalog.listBranches(),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (branchId || branches.length === 0) return;
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (cancelled) return;
      const initial = branches.find((b) => b.id === stored) ?? branches[0];
      if (initial) setBranchIdState(initial.id);
    });
    return () => {
      cancelled = true;
    };
  }, [branches, branchId]);

  const setBranchId = useCallback((id: string) => {
    setBranchIdState(id);
    void AsyncStorage.setItem(STORAGE_KEY, id);
  }, []);

  const branch = useMemo(
    () => branches.find((b) => b.id === branchId) ?? null,
    [branches, branchId],
  );

  const value = useMemo(
    () => ({ branches, branchId, branch, isLoading, setBranchId }),
    [branches, branchId, branch, isLoading, setBranchId],
  );

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranch(): BranchContextValue {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error("useBranch must be used within a BranchProvider");
  }
  return context;
}
