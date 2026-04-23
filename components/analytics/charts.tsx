"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const CHART_COLORS = [
  "hsl(210 80% 50%)",
  "hsl(158 50% 45%)",
  "hsl(35 80% 55%)",
  "hsl(280 55% 55%)",
  "hsl(0 65% 60%)",
  "hsl(50 75% 55%)",
  "hsl(180 55% 45%)",
  "hsl(320 55% 55%)",
];

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);
}

export function SimpleLine({
  data,
  xKey,
  yKey,
  money,
  height = 240,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  money?: boolean;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={money ? (v) => fmtMoney(Number(v)) : undefined} />
        <Tooltip formatter={money ? (v) => fmtMoney(Number(v)) : undefined} />
        <Line type="monotone" dataKey={yKey} stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SimpleArea({
  data, xKey, yKey, money, height = 240,
}: {
  data: Record<string, unknown>[];
  xKey: string; yKey: string; money?: boolean; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="fillPrimary" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.4} />
            <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={money ? (v) => fmtMoney(Number(v)) : undefined} />
        <Tooltip formatter={money ? (v) => fmtMoney(Number(v)) : undefined} />
        <Area type="monotone" dataKey={yKey} stroke={CHART_COLORS[0]} fill="url(#fillPrimary)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SimpleBar({
  data, xKey, yKey, horizontal, money, height = 240,
}: {
  data: Record<string, unknown>[];
  xKey: string; yKey: string; horizontal?: boolean; money?: boolean; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={money ? (v) => fmtMoney(Number(v)) : undefined} />
            <YAxis type="category" dataKey={xKey} tick={{ fontSize: 11 }} width={130} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={money ? (v) => fmtMoney(Number(v)) : undefined} />
          </>
        )}
        <Tooltip formatter={money ? (v) => fmtMoney(Number(v)) : undefined} />
        <Bar dataKey={yKey} fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SimplePie({
  data, nameKey, valueKey, money, height = 240,
}: {
  data: Record<string, unknown>[];
  nameKey: string; valueKey: string; money?: boolean; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          nameKey={nameKey}
          dataKey={valueKey}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={money ? (v) => fmtMoney(Number(v)) : undefined} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function StackedBar({
  data, xKey, keys, money, height = 240,
}: {
  data: Record<string, unknown>[];
  xKey: string; keys: string[]; money?: boolean; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={money ? (v) => fmtMoney(Number(v)) : undefined} />
        <Tooltip formatter={money ? (v) => fmtMoney(Number(v)) : undefined} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {keys.map((k, i) => (
          <Bar key={k} dataKey={k} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
