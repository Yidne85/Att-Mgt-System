export type UserRole = "admin" | "support";

export type UserProfile = {
  user_id: string;
  org_id: string;
  username: string;
  role: UserRole;
};

import { supabase } from "./supabase";

export async function getMyProfile(): Promise<UserProfile | null> {
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) return null;
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", sess.session.user.id)
    .maybeSingle();
  if (error) return null;
  return data as any;
}

export async function requireProfile(): Promise<UserProfile> {
  const p = await getMyProfile();
  if (!p) {
    window.location.href = "/login";
    throw new Error("No profile/session");
  }
  return p;
}
