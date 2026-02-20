"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, usernameToEmail } from "../../lib/supabase";
import { Button, Card, Hint, Input } from "../../components/ui";

export default function Register() {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [orgName, setOrgName] = useState("My School");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      if (pin.length < 4) throw new Error("PIN must be at least 4 characters");
      const email = usernameToEmail(username);
      const { data, error } = await supabase.auth.signUp({ email, password: pin });
      if (error) throw error;

      // create org + default attendance types
      const userId = data.user?.id;
      if (!userId) throw new Error("Signup succeeded but user id missing. Try logging in.");

      const { data: org, error: orgErr } = await supabase
        .from("orgs")
        .insert({ name: orgName, owner_user_id: userId })
        .select("*")
        .single();
      if (orgErr) throw orgErr;

      const types = [
        { org_id: org.id, name: "present", points: 1.0 },
        { org_id: org.id, name: "late", points: 0.75 },
        { org_id: org.id, name: "absent", points: 0.0 },
      ];
      await supabase.from("attendance_types").insert(types);

      router.push("/app");
    } catch (ex: any) {
      setErr(ex?.message ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title="Create admin account">
      <form onSubmit={onSubmit} className="grid gap-3 max-w-sm">
        <div>
          <label className="text-sm font-medium">Organization / School name</label>
          <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">Username</label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. admin1" />
          <Hint>No student login. Only admins.</Hint>
        </div>
        <div>
          <label className="text-sm font-medium">PIN</label>
          <Input value={pin} onChange={(e) => setPin(e.target.value)} type="password" inputMode="numeric" />
          <Hint>Use 4–10 digits.</Hint>
        </div>
        {err ? <div className="text-sm text-red-600">{err}</div> : null}
        <Button disabled={loading} type="submit">
          {loading ? "Creating..." : "Create account"}
        </Button>
      </form>
    </Card>
  );
}
