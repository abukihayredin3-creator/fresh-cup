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

/** There's no customer-facing "list tables" endpoint — only `GET /tables/:qrToken`, reached
 * by scanning the table's QR code (see the web app's table-context.tsx). Session-scoped: a
 * table choice shouldn't persist across visits, so it's cleared on logout, not just app close. */
export function DineInTableProvider({ children }: { children: ReactNode }) {
  const [table, setTableState] = useState<DineInTable | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setTableState(JSON.parse(raw) as DineInTable);
      })
      .catch(() => {});
  }, []);

  const setTable = useCallback((next: DineInTable) => {
    setTableState(next);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const clearTable = useCallback(() => {
    setTableState(null);
    void AsyncStorage.removeItem(STORAGE_KEY);
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
