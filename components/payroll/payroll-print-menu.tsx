"use client";

import Link from "next/link";
import { Download, FileText, Printer, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Print / export options for one pay week. The two printable layouts live on
 * their own route (…/print) and open in a new tab, so the week page keeps its
 * on-screen tools while a clean sheet goes to the printer.
 */
export function PayrollPrintMenu({ weekId }: { weekId: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Printer className="size-4" /> Print
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Print</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={`/payroll/${weekId}/print?mode=register`} target="_blank">
            <FileText className="size-4" />
            <div className="flex flex-col">
              <span>Payroll register</span>
              <span className="text-xs text-muted-foreground">Whole week, one landscape sheet</span>
            </div>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/payroll/${weekId}/print?mode=stubs`} target="_blank">
            <Receipt className="size-4" />
            <div className="flex flex-col">
              <span>Pay stubs</span>
              <span className="text-xs text-muted-foreground">One page per employee</span>
            </div>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => window.print()}>
          <Printer className="size-4" />
          <span>This page as-is</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Export</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <a href={`/api/export/payroll-week?week_id=${weekId}`} download>
            <Download className="size-4" />
            <span>CSV (entries, cash, payments)</span>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
