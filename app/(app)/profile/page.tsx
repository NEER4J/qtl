import { AtSign, Building2, CalendarDays, Clock, Mail, ShieldCheck } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireProfile } from "@/lib/auth/require";
import { createClient } from "@/lib/supabase/server";
import { getInitials } from "@/lib/utils";
import { isSyntheticEmail } from "@/lib/schemas/users";
import type { UserRole } from "@/lib/db/types";
import { accessibleLocationIds, locationMode } from "@/lib/auth/locations";
import {
  formatDate,
  formatDateTime as sharedFormatDateTime,
} from "@/lib/utils/format";

import { ProfileForm } from "./profile-form";
import { ChangePasswordForm } from "./change-password-form";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  co_owner: "Admin",
  manager: "Manager",
  supervisor: "Supervisor",
  accountant: "Accountant",
  staff: "Staff",
  technician: "Technician",
  employee: "Employee",
  portal_customer: "Portal Customer",
};

// Roles that inherently span every location — no single location to show.
const ALL_LOCATION_ROLES = new Set<UserRole>(["owner", "co_owner", "accountant"]);

function formatDateTime(value: string | null): string {
  if (!value) return "Never";
  return sharedFormatDateTime(value);
}

function MetaRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Mail;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-medium">{children}</div>
      </div>
    </div>
  );
}

export default async function ProfilePage() {
  const profile = await requireProfile();

  // Resolve the assigned location name when the role is tied to one.
  let locationName: string | null = null;
  if (profile.location_id && !ALL_LOCATION_ROLES.has(profile.role)) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("locations")
      .select("name")
      .eq("id", profile.location_id)
      .maybeSingle();
    locationName = (data?.name as string | undefined) ?? null;
  }

  const usesUsername = !!profile.username;
  const realEmail = isSyntheticEmail(profile.email) ? null : profile.email;
  const loginIdentity = usesUsername ? `@${profile.username}` : profile.email;

  const mode = locationMode(profile);
  const locationDisplay =
    mode === "all"
      ? "All locations"
      : mode === "multi"
        ? `${accessibleLocationIds(profile)?.length ?? 0} locations`
        : (locationName ?? "Unassigned");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Your account details, name, and password.
        </p>
      </div>

      {/* Identity summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Avatar className="size-16 rounded-xl">
              <AvatarFallback className="rounded-xl text-lg">
                {getInitials(profile.full_name || loginIdentity)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-xl font-semibold">
                  {profile.full_name || "Unnamed user"}
                </span>
                <Badge variant="secondary">{ROLE_LABELS[profile.role]}</Badge>
                {!profile.active && <Badge variant="destructive">Inactive</Badge>}
              </div>
              <div className="truncate text-sm text-muted-foreground">{loginIdentity}</div>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="grid gap-5 sm:grid-cols-2">
            <MetaRow icon={usesUsername ? AtSign : Mail} label={usesUsername ? "Username" : "Email"}>
              {loginIdentity}
            </MetaRow>
            {usesUsername && realEmail && (
              <MetaRow icon={Mail} label="Email">
                {realEmail}
              </MetaRow>
            )}
            <MetaRow icon={ShieldCheck} label="Role">
              {ROLE_LABELS[profile.role]}
            </MetaRow>
            <MetaRow icon={Building2} label="Location">
              {locationDisplay}
            </MetaRow>
            <MetaRow icon={CalendarDays} label="Member since">
              {formatDate(profile.created_at)}
            </MetaRow>
            <MetaRow icon={Clock} label="Last sign-in">
              {formatDateTime(profile.last_login_at)}
            </MetaRow>
          </div>
        </CardContent>
      </Card>

      {/* Editable name */}
      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm fullName={profile.full_name} />
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
