import { headers } from "next/headers";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { clientIpFromHeaders } from "@/lib/security/client-ip";

export const dynamic = "force-dynamic";

/**
 * Where the middleware sends a signed-in user whose network isn't on the
 * allowlist. Deliberately outside the (app) route group — the sidebar layout
 * loads data this user has no business fetching, and /blocked is exempt from
 * the lock so it can't redirect to itself.
 */
export default async function BlockedPage({
  searchParams,
}: {
  searchParams: Promise<{ ip?: string }>;
}) {
  const { ip: ipParam } = await searchParams;
  const ip = ipParam || clientIpFromHeaders(await headers()) || "unknown";

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="size-5 text-destructive" />
          </div>
          <CardTitle>Access restricted</CardTitle>
          <CardDescription>
            This account can only be used from an approved network.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="text-muted-foreground">Your current IP address</p>
            <p className="font-mono text-base">{ip}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            If you should have access from here, send this address to your
            administrator and ask them to add it under Settings → IP Access.
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="flex-1">
              <a href="/dashboard">Try again</a>
            </Button>
            <form action="/auth/signout" method="post" className="flex-1">
              <Button type="submit" className="w-full">
                Sign out
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
