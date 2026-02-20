import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function usernameToEmail(username: string) {
  // Simple mapping so UI can use username + PIN while Supabase Auth uses email/password.
  const u = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return `${u}@attendance.local`;
}
