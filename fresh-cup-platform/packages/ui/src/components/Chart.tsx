"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { colors } from "../tokens";

export interface ChartSeries {
  key: string;
  label: string;
  color?: string;
}

export interface ChartProps {
  data: Record<string, string | number>[];
  xKey: string;
  series: ChartSeries[];
  height?: number;
  valueFormatter?: (value: number) => string;
}

const DEFAULT_PALETTE = [colors.green700, colors.orange600, colors.green900, colors.neutral500];

function seriesColor(series: ChartSeries, index: number): string {
  return series.color ?? DEFAULT_PALETTE[index % DEFAULT_PALETTE.length]!;
}

/** Thin recharts wrapper — callers pass already-shaped data, no data-fetching or aggregation here. */
export function LineChartWidget({ data, xKey, series, height = 280, valueFormatter }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.neutral200} />
        <XAxis dataKey={xKey} stroke={colors.neutral500} fontSize={12} tickLine={false} />
        <YAxis
          stroke={colors.neutral500}
          fontSize={12}
          tickLine={false}
          tickFormatter={valueFormatter}
        />
        <Tooltip
          formatter={valueFormatter ? (value) => valueFormatter(Number(value)) : undefined}
        />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={seriesColor(s, i)}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BarChartWidget({ data, xKey, series, height = 280, valueFormatter }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.neutral200} />
        <XAxis dataKey={xKey} stroke={colors.neutral500} fontSize={12} tickLine={false} />
        <YAxis
          stroke={colors.neutral500}
          fontSize={12}
          tickLine={false}
          tickFormatter={valueFormatter}
        />
        <Tooltip
          formatter={valueFormatter ? (value) => valueFormatter(Number(value)) : undefined}
        />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={seriesColor(s, i)}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
