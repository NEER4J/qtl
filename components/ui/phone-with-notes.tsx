"use client";

import * as React from "react";
import { StickyNote } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Phone input + per-slot notes button (matches CARS "Phone Notes" boxes
// next to each phone slot on the Customer screen).
export function PhoneWithNotes({
  value,
  onChange,
  note,
  onNoteChange,
}: {
  value: string;
  onChange: (digits: string) => void;
  note: string;
  onNoteChange: (note: string) => void;
}) {
  const hasNote = note.trim().length > 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <PhoneInput value={value} onChange={onChange} />
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              "shrink-0",
              hasNote && "border-primary text-primary",
            )}
            title={hasNote ? "Edit note" : "Add note"}
          >
            <StickyNote className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72">
          <div className="space-y-2">
            <div className="text-sm font-medium">Phone notes</div>
            <Textarea
              rows={4}
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="e.g. Best to call 9–5 weekdays"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
