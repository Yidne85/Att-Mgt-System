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
    } catch (ex: any) {
      setErr(ex?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title="Admin login">
      <form onSubmit={onSubmit} className="grid gap-3 max-w-sm">
        <div>
          <label className="text-sm font-medium">Username</label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. admin1" />
          <Hint>Use your username. Internally it maps to an email.</Hint>
        </div>
        <div>
          <label className="text-sm font-medium">PIN</label>
          <Input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="4-10 digits"
            type="password"
            inputMode="numeric"
          />
        </div>
        {err ? <div className="text-sm text-red-600">{err}</div> : null}
        <Button disabled={loading} type="submit">
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </Card>
  );
}
