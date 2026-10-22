"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileDown, Mail, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** Every address in a "To" box: commas, semicolons or spaces between them. */
function parseAddresses(text: string): string[] {
  return text.split(/[\s,;]+/).map((a) => a.trim()).filter(Boolean);
}

export interface ShareLink {
  url: string;
  days: number;
}

export interface PdfEmailOptions {
  /** Dialog title, e.g. "Email invoice 12345". */
  title: string;
  /** Prefilled "To" — editable, any address, comma separated. */
  defaultTo: string | null;
  /** Shown under the box when there is no address on file. */
  noAddressHint: string;
  /** Changes when the document does — a fresh link is made for each. */
  linkKey: string;
  /** Stores the PDF and returns a link the recipient can open signed out. */
  getLink: () => Promise<ShareLink>;
  subject: string;
  body: (link: ShareLink) => string;
}

/**
 * Print, Download PDF and Email for a document served as a PDF (client
 * 2026-10-20 — invoices, monthly statements).
 *
 * Print and Download read the PDF straight from `pdfUrl` — a plain request
 * the browser doesn't treat as a pop-up. Email opens the shop's email app
 * (a mailto: link — the app sends nothing itself) with the message written:
 * to the customer or any other address, with a link to the PDF.
 */
export function PdfShareActions({ pdfUrl, email }: { pdfUrl: string; email: PdfEmailOptions }) {
  const [printing, setPrinting] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const downloadUrl = `${pdfUrl}${pdfUrl.includes("?") ? "&" : "?"}download=1`;

  const print = () => {
    setPrinting(true);
    // Load the PDF in a hidden frame and print it from there; if the browser
    // won't print a PDF frame, show the PDF in a new tab to print from.
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    frame.src = pdfUrl;
    frame.onload = () => {
      setPrinting(false);
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        window.open(pdfUrl, "_blank");
      }
      setTimeout(() => frame.remove(), 60_000);
    };
    document.body.appendChild(frame);
  };

  return (
    <>
      <Button variant="outline" onClick={print} disabled={printing}>
        <Printer className="size-4" /> {printing ? "Preparing…" : "Print"}
      </Button>
      <Button variant="outline" asChild>
        <a href={downloadUrl}>
          <FileDown className="size-4" /> Download PDF
        </a>
      </Button>
      <Button variant="outline" onClick={() => setEmailOpen(true)}>
        <Mail className="size-4" /> Email
      </Button>
      <EmailPdfDialog open={emailOpen} onOpenChange={setEmailOpen} email={email} />
    </>
  );
}

function EmailPdfDialog({
  open,
  onOpenChange,
  email,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: PdfEmailOptions;
}) {
  const [to, setTo] = useState("");
  const [link, setLink] = useState<ShareLink | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  // The caller passes inline functions; keep the latest without re-running
  // the effect (and making a new link) on every render.
  const getLinkRef = useRef(email.getLink);
  getLinkRef.current = email.getLink;
  const { defaultTo, linkKey, subject, body } = email;

  // A fresh link each time the dialog opens, so it matches the document now.
  useEffect(() => {
    if (!open) return;
    setTo(defaultTo ?? "");
    setLink(null);
    setLinkError(null);
    let cancelled = false;
    getLinkRef
      .current()
      .then((l) => !cancelled && setLink(l))
      .catch(() => !cancelled && setLinkError("Couldn't make a link to the PDF. Try again."));
    return () => {
      cancelled = true;
    };
  }, [open, linkKey, defaultTo]);

  const addresses = parseAddresses(to);
  const badAddress = addresses.find((a) => !EMAIL.test(a));
  const ready = link != null && addresses.length > 0 && !badAddress;

  const mailto = useMemo(() => {
    if (!link) return "";
    return `mailto:${parseAddresses(to).join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body(link))}`;
  }, [link, to, subject, body]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{email.title}</DialogTitle>
          <DialogDescription>
            Opens your email app with the message written and a link to the PDF. Send it to
            the customer or to any other address.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="pdf-email-to">To</Label>
          <Input
            id="pdf-email-to"
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="name@example.com — add more with commas"
          />
          {badAddress ? (
            <p className="text-xs text-destructive">&ldquo;{badAddress}&rdquo; isn&apos;t an email address.</p>
          ) : !defaultTo ? (
            <p className="text-xs text-muted-foreground">{email.noAddressHint}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {linkError ??
              (link
                ? `The link to the PDF works for ${link.days} days.`
                : "Preparing the link to the PDF…")}
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {ready ? (
            <Button asChild>
              <a href={mailto} onClick={() => onOpenChange(false)}>
                <Mail className="size-4" /> Open in email app
              </a>
            </Button>
          ) : (
            <Button disabled>
              <Mail className="size-4" /> Open in email app
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
