"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, usernameToEmail } from "../../lib/supabase";
import { Button, Card, Hint, Input } from "../../components/ui";

export default function Register() {
  const [orgName, setOrgName] = useState("My School");
  const [username, setUsername] = useState("admin");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const email = usernameToEmail(username);
      const { data, error } = await supabase.auth.signUp({ email, password: pin });
      if (error) throw error;
      if (!data.user) throw new Error("Could not create user");

      const { data: org, error: orgErr } = await supabase
        .from("orgs")
        .insert([{ name: orgName, owner_user_id: data.user.id }])
        .select("*")
        .single();
      if (orgErr) throw orgErr;

      const { error: profErr } = await supabase.from("user_profiles").insert([
        { user_id: data.user.id, org_id: org.id, username, role: "admin" },
      ]);
      if (profErr) throw profErr;

      router.push("/app");
    } catch (e: any) {
      setErr(e?.message ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[75vh] grid place-items-center">
      <div className="w-full max-w-lg">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs text-slate-600 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Attendance QR
          </div>
          <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight">Create admin account</h1>
          <p className="mt-1 text-sm text-slate-600">Create your organization and the first admin user.</p>
        </div>

        <Card>
          {err ? <div className="mb-3 text-sm text-rose-700">{err}</div> : null}

          <form onSubmit={onSubmit} className="grid gap-4">
            <div>
              <label className="text-sm font-medium text-slate-800">Organization / School name</label>
              <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-800">Username</label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
              <Hint>No student login. Only staff users.</Hint>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-800">PIN</label>
              <Input value={pin} onChange={(e) => setPin(e.target.value)} type="password" />
              <Hint>Use 4–10 digits.</Hint>
            </div>

            <Button type="submit" disabled={loading || !orgName.trim() || !username.trim() || pin.trim().length < 4}>
              {loading ? "Creating…" : "Create account"}
            </Button>
          </form>
        </Card>

        <div className="mt-6 text-center text-xs text-slate-500">After login, use “Users” to create Support accounts.</div>
      </div>
    </div>
  );
}
