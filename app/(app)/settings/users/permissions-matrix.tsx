"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight, EyeOff, RotateCcw, Sparkles, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  PAGE_GROUPS,
  PAGE_REGISTRY,
  columnsForPage,
  defaultAllowedPagesForRole,
} from "@/lib/permissions/registry";
import type { UserRole } from "@/lib/db/types";

import type { UserListRow } from "@/lib/actions/users";

interface Props {
  role: UserRole;
  allowedPages: string[] | null;
  hiddenColumns: Record<string, string[]>;
  otherUsers?: UserListRow[];
  onChange: (next: {
    allowed_pages: string[] | null;
    hidden_columns: Record<string, string[]>;
  }) => void;
}

const PAGES_WITH_COLUMNS = new Set(
  PAGE_REGISTRY.filter((p) => columnsForPage(p.key).length > 0).map((p) => p.key),
);

export function PermissionsMatrix({
  role,
  allowedPages,
  hiddenColumns,
  otherUsers,
  onChange,
}: Props) {
  const initialAllowed = useMemo<string[]>(
    () => allowedPages ?? defaultAllowedPagesForRole(role),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [allowed, setAllowed] = useState<Set<string>>(new Set(initialAllowed));
  const [hidden, setHidden] = useState<Record<string, Set<string>>>(() => {
    const out: Record<string, Set<string>> = {};
    for (const [k, v] of Object.entries(hiddenColumns ?? {})) {
      out[k] = new Set(v);
    }
    return out;
  });
  const [usingRoleDefault, setUsingRoleDefault] = useState(allowedPages === null);

  // The page whose columns are visible in the right panel.
  const firstPageWithCols =
    PAGE_REGISTRY.find((p) => allowed.has(p.key) && PAGES_WITH_COLUMNS.has(p.key))?.key ??
    PAGE_REGISTRY.find((p) => PAGES_WITH_COLUMNS.has(p.key))?.key ??
    null;
  const [focusedPage, setFocusedPage] = useState<string | null>(firstPageWithCols);

  const commit = (
    nextAllowed: Set<string>,
    nextHidden: Record<string, Set<string>>,
    nextUsingDefault: boolean,
  ) => {
    setAllowed(nextAllowed);
    setHidden(nextHidden);
    setUsingRoleDefault(nextUsingDefault);
    onChange({
      allowed_pages: nextUsingDefault ? null : Array.from(nextAllowed),
      hidden_columns: Object.fromEntries(
        Object.entries(nextHidden)
          .filter(([, v]) => v.size > 0)
          .map(([k, v]) => [k, Array.from(v)]),
      ),
    });
  };

  const togglePage = (key: string) => {
    const next = new Set(allowed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    commit(next, hidden, false);
  };

  const allPageKeys = PAGE_REGISTRY.map((p) => p.key);
  const allSelected = allPageKeys.every((k) => allowed.has(k));
  const noneSelected = allowed.size === 0;
  const roleDefaultSet = new Set(defaultAllowedPagesForRole(role));

  const selectAllPages = () => commit(new Set(allPageKeys), hidden, false);
  const clearAllPages = () => commit(new Set(), hidden, false);
  const resetToRoleDefault = () => commit(new Set(defaultAllowedPagesForRole(role)), {}, true);

  const copyFromUser = (sourceUserId: string) => {
    const src = otherUsers?.find((u) => u.id === sourceUserId);
    if (!src) return;
    const nextAllowed = new Set(src.allowed_pages ?? defaultAllowedPagesForRole(src.role));
    const nextHidden: Record<string, Set<string>> = {};
    for (const [k, v] of Object.entries(src.hidden_columns ?? {})) {
      nextHidden[k] = new Set(v);
    }
    commit(nextAllowed, nextHidden, src.allowed_pages === null);
  };

  const toggleColumn = (pageKey: string, columnKey: string) => {
    const set = new Set(hidden[pageKey] ?? []);
    if (set.has(columnKey)) set.delete(columnKey);
    else set.add(columnKey);
    const next = { ...hidden, [pageKey]: set };
    commit(allowed, next, usingRoleDefault);
  };

  const hideAllColumns = (pageKey: string) => {
    const allCols = columnsForPage(pageKey).map((c) => c.key);
    const next = { ...hidden, [pageKey]: new Set(allCols) };
    commit(allowed, next, usingRoleDefault);
  };
  const showAllColumns = (pageKey: string) => {
    const next = { ...hidden, [pageKey]: new Set<string>() };
    commit(allowed, next, usingRoleDefault);
  };

  // ----- counts for the toolbar
  const allowedCount = allowed.size;
  const totalPages = allPageKeys.length;
  const hiddenColumnTotal = Object.values(hidden).reduce((acc, s) => acc + s.size, 0);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {usingRoleDefault ? (
            <Badge variant="secondary" className="gap-1 font-normal">
              <Sparkles className="size-3" /> Role default
            </Badge>
          ) : (
            <Badge variant="default" className="font-normal">Custom</Badge>
          )}
          <span className="text-muted-foreground">
            {allowedCount}/{totalPages} pages
          </span>
          {hiddenColumnTotal > 0 && (
            <span className="text-muted-foreground">
              · {hiddenColumnTotal} column{hiddenColumnTotal === 1 ? "" : "s"} hidden
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={selectAllPages} disabled={allSelected}>
            <Check className="size-3.5" /> Select all
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={clearAllPages} disabled={noneSelected}>
            <X className="size-3.5" /> Clear
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={resetToRoleDefault}>
            <RotateCcw className="size-3.5" /> Reset
          </Button>
          {otherUsers && otherUsers.length > 0 && (
            <Select onValueChange={copyFromUser}>
              <SelectTrigger className="h-8 w-[170px] text-xs">
                <SelectValue placeholder="Copy from user…" />
              </SelectTrigger>
              <SelectContent>
                {otherUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id} className="text-xs">
                    {u.full_name || u.username || u.email} · {u.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Master / detail */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(260px,320px)_1fr]">
        {/* Pages list */}
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="border-b bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Pages
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            {PAGE_GROUPS.map((group) => {
              const groupPages = PAGE_REGISTRY.filter((p) => p.group === group);
              if (groupPages.length === 0) return null;
              return (
                <div key={group} className="border-b last:border-b-0">
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                    {group}
                  </div>
                  <ul>
                    {groupPages.map((p) => {
                      const isOn = allowed.has(p.key);
                      const isFocused = focusedPage === p.key;
                      const isRoleDefault = roleDefaultSet.has(p.key);
                      const hasColumns = PAGES_WITH_COLUMNS.has(p.key);
                      const hiddenCount = hidden[p.key]?.size ?? 0;
                      const diverged = isRoleDefault !== isOn;
                      return (
                        <li key={p.key}>
                          <button
                            type="button"
                            onClick={() => hasColumns && setFocusedPage(p.key)}
                            className={cn(
                              "group flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm",
                              hasColumns ? "cursor-pointer" : "cursor-default",
                              isFocused && "bg-accent",
                              !isFocused && hasColumns && "hover:bg-muted/60",
                            )}
                          >
                            <span
                              role="checkbox"
                              aria-checked={isOn}
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePage(p.key);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") {
                                  e.preventDefault();
                                  togglePage(p.key);
                                }
                              }}
                              className="flex items-center justify-center"
                            >
                              <Checkbox checked={isOn} className="size-4" tabIndex={-1} />
                            </span>
                            <span className={cn("flex-1 truncate", !isOn && "text-muted-foreground")}>
                              {p.label}
                            </span>
                            {diverged && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "h-4 px-1 text-[9px] font-medium uppercase tracking-wide",
                                  isOn ? "border-emerald-300 text-emerald-700" : "border-rose-300 text-rose-700",
                                )}
                              >
                                {isOn ? "+" : "−"}
                              </Badge>
                            )}
                            {hiddenCount > 0 && (
                              <span
                                className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground"
                                title={`${hiddenCount} column${hiddenCount === 1 ? "" : "s"} hidden`}
                              >
                                <EyeOff className="size-3" />
                                {hiddenCount}
                              </span>
                            )}
                            {hasColumns && (
                              <ChevronRight
                                className={cn(
                                  "size-3.5 shrink-0 text-muted-foreground/60 transition-transform",
                                  isFocused && "translate-x-0.5 text-foreground",
                                )}
                              />
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        {/* Column detail panel */}
        <div className="rounded-lg border bg-card overflow-hidden">
          {focusedPage && PAGES_WITH_COLUMNS.has(focusedPage) ? (
            <ColumnDetail
              pageKey={focusedPage}
              pageEnabled={allowed.has(focusedPage)}
              hidden={hidden[focusedPage] ?? new Set<string>()}
              onToggle={(c) => toggleColumn(focusedPage, c)}
              onHideAll={() => hideAllColumns(focusedPage)}
              onShowAll={() => showAllColumns(focusedPage)}
            />
          ) : (
            <div className="flex h-full min-h-[200px] items-center justify-center px-6 py-10 text-center text-sm text-muted-foreground">
              Select a page on the left to see its columns. Pages without configurable columns just inherit the page-level on/off setting.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ColumnDetail({
  pageKey,
  pageEnabled,
  hidden,
  onToggle,
  onHideAll,
  onShowAll,
}: {
  pageKey: string;
  pageEnabled: boolean;
  hidden: Set<string>;
  onToggle: (col: string) => void;
  onHideAll: () => void;
  onShowAll: () => void;
}) {
  const cols = columnsForPage(pageKey);
  const allHidden = cols.length > 0 && cols.every((c) => hidden.has(c.key));
  const noneHidden = hidden.size === 0;
  const page = PAGE_REGISTRY.find((p) => p.key === pageKey);

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{page?.label ?? "Columns"}</span>
          {!pageEnabled && (
            <Badge variant="outline" className="text-[10px]">
              page disabled
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onShowAll}
            disabled={noneHidden}
          >
            Show all
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onHideAll}
            disabled={allHidden}
          >
            Hide all
          </Button>
        </div>
      </div>
      {!pageEnabled && (
        <div className="px-4 py-2 text-xs text-muted-foreground">
          This page is currently disabled for the user. Enabling it will show the columns ticked below.
        </div>
      )}
      <ul className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3">
        {cols.map((c) => {
          const visible = !hidden.has(c.key);
          return (
            <li key={c.key} className="bg-card">
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-muted/40",
                  !visible && "opacity-60",
                )}
                title={c.hint}
              >
                <Checkbox
                  checked={visible}
                  onCheckedChange={() => onToggle(c.key)}
                  className="mt-0.5 size-4"
                />
                <span className="leading-tight">{c.label}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
