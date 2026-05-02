"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyJobReport } from "@/lib/actions/reports";

const STATUS_COLORS: Record<string, string> = {
  new: "hsl(142 71% 45%)",
  regular: "hsl(217 91% 60%)",
  old: "hsl(35 91% 55%)",
  unknown: "hsl(220 9% 46%)",
};

const SERVICE_COLORS = [
  "hsl(158 58% 32%)",
  "hsl(217 91% 60%)",
  "hsl(35 91% 55%)",
  "hsl(285 70% 55%)",
  "hsl(0 72% 55%)",
];

export function DailyReportCharts({ report }: { report: DailyJobReport }) {
  const hourData = padHours(report.by_hour);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Revenue by hour</CardTitle>
        </CardHeader>
        <CardContent>
          {hourData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No timed jobs.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                />
                <Tooltip
                  formatter={(value, name) =>
                    name === "Revenue"
                      ? new Intl.NumberFormat("en-CA", {
                          style: "currency",
                          currency: "CAD",
                          maximumFractionDigits: 0,
                        }).format(Number(value))
                      : value
                  }
                />
                <Bar dataKey="revenue" name="Revenue" radius={[3, 3, 0, 0]} className="fill-primary" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By service</CardTitle>
        </CardHeader>
        <CardContent>
          {report.by_service.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={report.by_service}
                  dataKey="revenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {report.by_service.map((_, idx) => (
                    <Cell key={idx} fill={SERVICE_COLORS[idx % SERVICE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) =>
                    new Intl.NumberFormat("en-CA", {
                      style: "currency",
                      currency: "CAD",
                      maximumFractionDigits: 0,
                    }).format(Number(value))
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer mix</CardTitle>
        </CardHeader>
        <CardContent>
          {report.by_customer_status.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={report.by_customer_status}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                >
                  {report.by_customer_status.map((row, idx) => (
                    <Cell
                      key={idx}
                      fill={STATUS_COLORS[row.status] ?? STATUS_COLORS.unknown}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function padHours(rows: DailyJobReport["by_hour"]): Array<{ label: string; revenue: number; count: number }> {
  if (rows.length === 0) return [];
  const min = Math.min(...rows.map((r) => r.hour));
  const max = Math.max(...rows.map((r) => r.hour));
  const out: Array<{ label: string; revenue: number; count: number }> = [];
  const byHour = new Map(rows.map((r) => [r.hour, r]));
  for (let h = min; h <= max; h++) {
    const r = byHour.get(h);
    out.push({
      label: `${String(h).padStart(2, "0")}:00`,
      revenue: r?.revenue ?? 0,
      count: r?.count ?? 0,
    });
  }
  return out;
}
