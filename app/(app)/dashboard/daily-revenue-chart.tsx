"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailySalesTrendRow } from "@/lib/actions/dashboard";

export function DailyRevenueChart({
  data,
  granularity = "day",
}: {
  data: DailySalesTrendRow[];
  granularity?: "day" | "month";
}) {
  const title = granularity === "month" ? "Monthly revenue" : "Daily revenue";
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48 text-sm text-muted-foreground">
          No sales recorded in this period.
        </CardContent>
      </Card>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    label: format(parseISO(d.day), granularity === "month" ? "MMM yyyy" : "MMM d"),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={formatted} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(v) =>
                v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
              }
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip
              formatter={(value) =>
                new Intl.NumberFormat("en-CA", {
                  style: "currency",
                  currency: "CAD",
                  maximumFractionDigits: 0,
                }).format(Number(value))
              }
              labelClassName="font-medium"
            />
            <Bar dataKey="total" name="Revenue" radius={[3, 3, 0, 0]} className="fill-primary" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
