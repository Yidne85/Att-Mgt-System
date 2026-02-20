import { supabase } from "./supabase";

export async function requireSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
