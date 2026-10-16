// One-off: replace Amanda Profit's half-created login with a normal one.
// Run from the repo root:  node --env-file=.env.local .amanda-rebuild.mjs
// Delete this file afterwards.
import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const OLD = "f8aa930f-1c8a-49d2-a2bc-19b848d67e45";
const NAPANEE = "774dd701-2936-4902-a5e0-e308367b33be";
const must = (r, what) => {
  if (r.error) {
    console.error(what, r.error);
    process.exit(1);
  }
  return r;
};

// 1. Detach her records (1 customer, 1 vehicle) so the auth delete isn't blocked.
for (const [t, col] of [["customers", "created_by"], ["customers", "updated_by"], ["vehicles", "created_by"], ["vehicles", "updated_by"]]) {
  const r = await s.from(t).update({ [col]: null }).eq(col, OLD).select("id");
  console.log("cleared", t, col, r.error ? `(${r.error.code} ${r.error.message})` : r.data.length);
}

// 2. Delete the old login (cascades to profile). If audit_log blocks it, blank
//    the actor on her 2 entries and retry.
let del = await s.auth.admin.deleteUser(OLD);
if (del.error) {
  console.log("delete blocked:", del.error.message, "- clearing audit_log.actor_id and retrying");
  must(await s.from("audit_log").update({ actor_id: null }).eq("actor_id", OLD), "audit clear");
  del = await s.auth.admin.deleteUser(OLD);
}
must(del, "delete user");
console.log("old account deleted");

// 3. Create the new login exactly the way inviteUser (the dashboard) does.
const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
const password = "Qtl-" + Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join("");
const created = must(
  await s.auth.admin.createUser({
    email: "amandap@team.qtl.app",
    password,
    email_confirm: true,
    user_metadata: { full_name: "Amanda Profit", username: "amandap" },
  }),
  "create user",
);
const id = created.data.user.id;

must(
  await s.from("profiles").upsert(
    {
      id,
      email: "amandap@team.qtl.app",
      username: "amandap",
      full_name: "Amanda Profit",
      role: "staff",
      location_id: NAPANEE,
      can_enter_expenses: false,
      cross_location: false,
      location_ids: null,
      allowed_pages: null,
      hidden_columns: {},
      allowed_actions: null,
      active: true,
    },
    { onConflict: "id" },
  ),
  "profile upsert",
);
must(
  await s.from("profile_credentials").upsert({ profile_id: id, password_plain: password }, { onConflict: "profile_id" }),
  "credentials",
);

const { data } = await s
  .from("profiles")
  .select("full_name, username, role, active, locations:location_id(name)")
  .eq("id", id);
console.log("new account:", JSON.stringify(data));
console.log("Password is visible in Settings → Users → Password column.");
