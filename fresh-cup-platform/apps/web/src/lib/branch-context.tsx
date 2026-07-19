"use client";

import type { Branch } from "@fresh-cup/types";
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
    // Branches load asynchronously via the query above, so the preferred branch can only be
    // resolved once they arrive — there's no synchronous initial value to derive this from.
    if (branchId || branches.length === 0) return;
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const initial = branches.find((b) => b.id === stored) ?? branches[0];
     
    if (initial) setBranchIdState(initial.id);
  }, [branches, branchId]);

  const setBranchId = useCallback((id: string) => {
    setBranchIdState(id);
    window.localStorage.setItem(STORAGE_KEY, id);
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
