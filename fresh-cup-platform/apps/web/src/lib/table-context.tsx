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

const STORAGE_KEY = "fresh-cup-dine-in-table";

export interface DineInTable {
  tableId: string;
  tableLabel: string;
  branchId: string;
}

interface TableContextValue {
  table: DineInTable | null;
  setTable: (table: DineInTable) => void;
  clearTable: () => void;
}

const TableContext = createContext<TableContextValue | null>(null);

function readStorage(): DineInTable | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DineInTable) : null;
  } catch {
    return null;
  }
}

/**
 * There's no customer-facing "list tables" endpoint (only `GET /tables/:qrToken`,
 * reached by scanning the table's QR code) — see TablesController. Dine-in
 * table selection is therefore scan-only, held in sessionStorage rather than
 * localStorage since a table choice shouldn't outlive the visit.
 */
export function DineInTableProvider({ children }: { children: ReactNode }) {
  const [table, setTableState] = useState<DineInTable | null>(null);

  useEffect(() => {
    // eslint-disable-next-line -- sessionStorage is unavailable during SSR; hydrated post-mount
    setTableState(readStorage());
  }, []);

  const setTable = useCallback((next: DineInTable) => {
    setTableState(next);
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const clearTable = useCallback(() => {
    setTableState(null);
    window.sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(() => ({ table, setTable, clearTable }), [table, setTable, clearTable]);

  return <TableContext.Provider value={value}>{children}</TableContext.Provider>;
}

export function useDineInTable(): TableContextValue {
  const context = useContext(TableContext);
  if (!context) {
    throw new Error("useDineInTable must be used within a DineInTableProvider");
  }
  return context;
}
