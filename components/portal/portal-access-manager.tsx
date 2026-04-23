"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { grantPortalAccess, revokePortalAccess } from "@/lib/actions/portal";

export function PortalAccessManager({
  customerId,
  existing,
}: {
  customerId: string;
  existing: { id: string; email: string; full_name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await grantPortalAccess({ customer_id: customerId, email, full_name: fullName });
    if (!result.ok) {
      toast.error(result.error);
    } else {
      toast.success(`Portal access granted to ${email}`);
      setOpen(false);
      setEmail("");
      setFullName("");
      router.refresh();
    }
    setSubmitting(false);
  }

  async function handleRevoke(linkId: string, email: string) {
    if (!confirm(`Revoke portal access for ${email}?`)) return;
    const result = await revokePortalAccess({ link_id: linkId });
    if (!result.ok) {
      toast.error(result.error);
    } else {
      toast.success("Access revoked");
      router.refresh();
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Portal users</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm"><Plus className="size-3.5" /> Grant access</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Grant portal access</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleGrant} className="space-y-3">
              <div>
                <Label>Email</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label>Full name</Label>
                <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">
                An account will be created (or linked if one exists). They receive a password-set email and can sign in at <code>/portal</code>.
              </p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}>{submitting ? "Granting…" : "Grant"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {existing.length === 0 ? (
        <p className="text-xs text-muted-foreground">No portal users linked.</p>
      ) : (
        <ul className="space-y-1.5">
          {existing.map((u) => (
            <li key={u.id} className="flex items-center justify-between text-sm">
              <div>
                <div className="font-medium">{u.full_name}</div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRevoke(u.id, u.email)}>
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
