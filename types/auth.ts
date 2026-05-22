import type { UserRole } from "@/lib/db/types";

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
  role?: UserRole;
  locationId?: string | null;
  canEnterExpenses?: boolean;
  active?: boolean;
}

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  /** `identifier` accepts either an email or a username (team-member accounts). */
  signIn: (identifier: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
}
