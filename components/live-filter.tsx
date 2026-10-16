"use client";

import {
  createContext,
  Fragment,
  useContext,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";

// For pages that already render their whole list on the server (the price
// lists): the filter bar narrows those rows in the browser instead of
// submitting a form that reloads the page. The rows stay server-rendered, so a
// role-gated column (cost) never reaches the browser as data; only the text
// each filter matches against does. The URL follows through
// history.replaceState, which Next keeps in step with useSearchParams without
// a request, so a reload or a shared link keeps the filters.

/** How a filter compares its input with a row's text for it. */
export type LiveFilterMode =
  /** Every word of the input appears somewhere in the text, any order. */
  | "words"
  /** The input appears in the text, ignoring case. */
  | "contains"
  /** Exact match, for select values such as ids. */
  | "equals";

export type LiveFilterRow = { key: string; text: Record<string, string | null | undefined> };

type Ctx = {
  values: Record<string, string>;
  set: (name: string, value: string) => void;
  clear: () => void;
  active: boolean;
  visible: ReadonlySet<string>;
  total: number;
};

const LiveFilterContext = createContext<Ctx | null>(null);

function useLiveFilter(): Ctx {
  const ctx = useContext(LiveFilterContext);
  if (!ctx) throw new Error("Live filter parts must sit inside <LiveFilterProvider>.");
  return ctx;
}

function matches(mode: LiveFilterMode, input: string, text: string): boolean {
  const needle = input.trim().toLowerCase();
  if (!needle) return true;
  const hay = text.toLowerCase();
  if (mode === "equals") return text === input;
  if (mode === "contains") return hay.includes(needle);
  return needle.split(/\s+/).every((w) => hay.includes(w));
}

export function LiveFilterProvider({
  filters,
  rows,
  children,
}: {
  /** Query-string name → how it matches. */
  filters: Record<string, LiveFilterMode>;
  /** Each row's key and the text every filter matches against. */
  rows: LiveFilterRow[];
  children: ReactNode;
}) {
  const searchParams = useSearchParams();
  const names = Object.keys(filters);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(names.map((n) => [n, searchParams.get(n) ?? ""])),
  );

  const writeUrl = (patch: Record<string, string>) => {
    const params = new URLSearchParams(window.location.search);
    for (const [name, value] of Object.entries(patch)) {
      if (value.trim()) params.set(name, value.trim());
      else params.delete(name);
    }
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  };

  const visible = useMemo(
    () =>
      new Set(
        rows
          .filter((row) =>
            Object.entries(filters).every(([name, mode]) =>
              matches(mode, values[name] ?? "", row.text[name] ?? ""),
            ),
          )
          .map((row) => row.key),
      ),
    [rows, filters, values],
  );

  const ctx: Ctx = {
    values,
    set: (name, value) => {
      setValues((prev) => ({ ...prev, [name]: value }));
      writeUrl({ [name]: value });
    },
    clear: () => {
      const empty = Object.fromEntries(names.map((n) => [n, ""]));
      setValues(empty);
      writeUrl(empty);
    },
    active: names.some((n) => (values[n] ?? "").trim() !== ""),
    visible,
    total: rows.length,
  };

  return <LiveFilterContext.Provider value={ctx}>{children}</LiveFilterContext.Provider>;
}

export function LiveFilterInput({
  name,
  ...props
}: { name: string } & Omit<ComponentProps<typeof Input>, "name" | "value" | "onChange">) {
  const { values, set } = useLiveFilter();
  return <Input {...props} value={values[name] ?? ""} onChange={(e) => set(name, e.target.value)} />;
}

export function LiveFilterSelect({
  name,
  ...props
}: { name: string } & Omit<ComponentProps<"select">, "name" | "value" | "onChange">) {
  const { values, set } = useLiveFilter();
  return <select {...props} value={values[name] ?? ""} onChange={(e) => set(name, e.target.value)} />;
}

/** Renders only while a filter is set. */
export function LiveFilterClear(props: Omit<ComponentProps<"button">, "type" | "onClick">) {
  const { active, clear } = useLiveFilter();
  if (!active) return null;
  return <button type="button" onClick={clear} {...props} />;
}

/** "N", or "X of N" while filtered. */
export function LiveFilterCount() {
  const { active, visible, total } = useLiveFilter();
  return <>{active ? `${visible.size} of ${total}` : total}</>;
}

/** The server-rendered rows, minus the ones the filters exclude. */
export function LiveFilterRows({
  items,
  empty,
}: {
  items: { key: string; node: ReactNode }[];
  /** Shown when rows exist but none match. */
  empty: ReactNode;
}) {
  const { visible } = useLiveFilter();
  const shown = items.filter((item) => visible.has(item.key));
  if (shown.length === 0) return <>{empty}</>;
  return (
    <>
      {shown.map((item) => (
        <Fragment key={item.key}>{item.node}</Fragment>
      ))}
    </>
  );
}
