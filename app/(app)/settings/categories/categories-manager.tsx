"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  toggleCategoryActive,
  toggleSubcategoryActive,
} from "@/lib/actions/categories";
import type { ExpenseCategory, ExpenseSubcategory } from "@/lib/db/types";

import { CategoryFormDialog } from "./category-form-dialog";
import { SubcategoryFormDialog } from "./subcategory-form-dialog";

export function CategoriesManager({
  categories,
  subcategories,
}: {
  categories: ExpenseCategory[];
  subcategories: ExpenseSubcategory[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(categories.map((c) => c.id)));
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [editingSubcat, setEditingSubcat] = useState<ExpenseSubcategory | null>(null);
  const [creatingSubcatFor, setCreatingSubcatFor] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleToggleCategory = (cat: ExpenseCategory) => {
    startTransition(async () => {
      const res = await toggleCategoryActive({ id: cat.id, active: !cat.active });
      if (!res.ok) toast.error(res.error);
      else toast.success(res.data.active ? "Category activated" : "Category deactivated");
    });
  };

  const handleToggleSubcat = (sub: ExpenseSubcategory) => {
    startTransition(async () => {
      const res = await toggleSubcategoryActive({ id: sub.id, active: !sub.active });
      if (!res.ok) toast.error(res.error);
      else toast.success(res.data.active ? "Subcategory activated" : "Subcategory deactivated");
    });
  };

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreatingCategory(true)}>
          <Plus className="size-4" /> New category
        </Button>
      </div>

      <div className="divide-y rounded-md border">
        {categories.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">No categories yet.</div>
        )}
        {categories.map((cat) => {
          const subs = subcategories.filter((s) => s.category_id === cat.id);
          const isExpanded = expanded.has(cat.id);

          return (
            <div key={cat.id}>
              {/* Category row */}
              <div className="flex items-center gap-2 px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleExpand(cat.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {isExpanded ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                </button>
                <span className={`flex-1 font-medium ${!cat.active ? "opacity-50" : ""}`}>
                  {cat.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({subs.filter((s) => s.active).length} subcategories)
                  </span>
                </span>
                <Badge variant={cat.active ? "default" : "secondary"} className="text-xs">
                  {cat.active ? "Active" : "Inactive"}
                </Badge>
                <Button variant="ghost" size="icon" onClick={() => setEditingCategory(cat)}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleToggleCategory(cat)}
                >
                  {cat.active ? "Deactivate" : "Activate"}
                </Button>
              </div>

              {/* Subcategories */}
              {isExpanded && (
                <div className="border-t bg-muted/30">
                  {subs.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center gap-2 px-4 py-2 pl-10 text-sm"
                    >
                      <span className={`flex-1 ${!sub.active ? "opacity-50" : ""}`}>
                        {sub.name}
                      </span>
                      <Badge variant={sub.active ? "outline" : "secondary"} className="text-xs">
                        {sub.active ? "Active" : "Inactive"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => setEditingSubcat(sub)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleToggleSubcat(sub)}
                      >
                        {sub.active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  ))}
                  <div className="px-4 py-2 pl-10">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCreatingSubcatFor(cat.id)}
                    >
                      <Plus className="size-3.5" /> Add subcategory
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <CategoryFormDialog
        open={creatingCategory}
        onOpenChange={setCreatingCategory}
        mode="create"
      />
      <CategoryFormDialog
        open={editingCategory !== null}
        onOpenChange={(open) => !open && setEditingCategory(null)}
        mode="edit"
        category={editingCategory ?? undefined}
      />
      <SubcategoryFormDialog
        open={creatingSubcatFor !== null}
        onOpenChange={(open) => !open && setCreatingSubcatFor(null)}
        mode="create"
        categoryId={creatingSubcatFor ?? ""}
      />
      <SubcategoryFormDialog
        open={editingSubcat !== null}
        onOpenChange={(open) => !open && setEditingSubcat(null)}
        mode="edit"
        subcategory={editingSubcat ?? undefined}
        categoryId={editingSubcat?.category_id ?? ""}
      />
    </>
  );
}
