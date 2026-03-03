export async function requireProfile() {
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) throw new Error("Not logged in");

  const userId = sess.session.user.id;

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (!profile) {
    // IMPORTANT: show a friendly message instead of crashing
    throw new Error("User profile not found. Please create the admin/support user first.");
  }

  return profile;
}
