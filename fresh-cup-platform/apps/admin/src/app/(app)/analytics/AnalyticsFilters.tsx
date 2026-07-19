"use client";

import type { Branch } from "@fresh-cup/types";
import { Button, DateRangePicker, Select, type DateRangeValue } from "@fresh-cup/ui";

export interface AnalyticsFiltersProps {
  range: DateRangeValue;
  onRangeChange: (range: DateRangeValue) => void;
  branchId: string | undefined;
  onBranchChange: (branchId: string | undefined) => void;
  branches: Branch[] | undefined;
  showBranchFilter: boolean;
  onExport: () => void;
  exportDisabled?: boolean;
}

export function AnalyticsFilters({
  range,
  onRangeChange,
  branchId,
  onBranchChange,
  branches,
  showBranchFilter,
  onExport,
  exportDisabled = false,
}: AnalyticsFiltersProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <DateRangePicker value={range} onChange={onRangeChange} />
        {showBranchFilter && branches && branches.length > 0 ? (
          <Select
            label="Branch"
            options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
            placeholder="All branches"
            value={branchId ?? ""}
            onChange={(event) => onBranchChange(event.target.value || undefined)}
            className="w-56"
          />
        ) : null}
      </div>
      <Button variant="secondary" onClick={onExport} disabled={exportDisabled}>
        Export CSV
      </Button>
    </div>
  );
}
