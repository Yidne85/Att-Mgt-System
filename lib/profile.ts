import { supabase } from "./supabase";

export type UserProfile = {
  id?: string;
  user_id: string;
  org_id: string;
  username: string;
  role: "admin" | "support";
  created_at?: string;
};

export async function getMyProfile(): Promise<UserProfile | null> {
  const { data: sess } = await supabase.auth.getSession();
  const session = sess.session;
  if (!session) return null;

  const userId = session.user.id;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data as UserProfile) ?? null;
}

export async function requireProfile(): Promise<UserProfile> {
  const p = await getMyProfile();
  if (!p) {
    throw new Error("User profile not found. Please create the admin/support user first.");
  }
  return p;
}
