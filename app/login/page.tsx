"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, usernameToEmail } from "../../lib/supabase";
import { Button, Card, Hint, Input } from "../../components/ui";

export default function Login() {
  const [username, setUsername] = useState("");
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
      const { error } = await supabase.auth.signInWithPassword({ email, password: pin });
      if (error) throw error;
      router.push("/app");
    } catch (e: any) {
      setErr(e?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[75vh] grid place-items-center">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs text-slate-600 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Attendance QR
          </div>
          <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight">Log in</h1>
          <p className="mt-1 text-sm text-slate-600">Use your username and PIN. Roles are detected automatically.</p>
        </div>

        <Card>
          {err ? <div className="mb-3 text-sm text-rose-700">{err}</div> : null}

          <form onSubmit={onSubmit} className="grid gap-4">
            <div>
              <label className="text-sm font-medium text-slate-800">Username</label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. admin1" />
              <Hint>Use your username. Internally it maps to an email.</Hint>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-800">PIN</label>
              <Input value={pin} onChange={(e) => setPin(e.target.value)} placeholder="4–10 digits" type="password" />
              <Hint>Ask your admin if you don’t have one.</Hint>
            </div>

            <Button type="submit" disabled={loading || !username.trim() || pin.trim().length < 4}>
              {loading ? "Signing in…" : "Log in"}
            </Button>
          </form>
        </Card>

        <div className="mt-6 text-center text-xs text-slate-500">© Attendance QR</div>
      </div>
    </div>
  );
}
