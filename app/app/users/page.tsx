"use client";

import { useEffect, useState } from "react";
import { supabase, usernameToEmail } from "../../../lib/supabase";
import { Button, Card, Hint, Input, Select } from "../../../components/ui";
import { requireProfile } from "../../../lib/profile";

type Row = { user_id: string; username: string; role: "admin" | "support"; created_at: string };

export default function UsersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState<"support" | "admin">("support");

  async function refresh() {
    setLoading(true);
    setErr(null);
    const p = await requireProfile();
    if (p.role !== "admin") {
      window.location.href = "/app";
      return;
    }
    const { data, error } = await supabase
      .from("user_profiles")
      .select("user_id,username,role,created_at")
      .eq("org_id", p.org_id)
      .order("created_at", { ascending: false });
    if (error) setErr(error.message);
    setRows((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  async function createUser() {
    setMsg(null);
    setErr(null);
    const p = await requireProfile();
    if (p.role !== "admin") return;

    const u = username.trim();
    if (!u || pin.trim().length < 4) {
      setErr("Enter a username and a 4+ digit PIN.");
      return;
    }

    const email = usernameToEmail(u);
    const { data, error } = await supabase.auth.signUp({ email, password: pin.trim() });
    if (error) { setErr(error.message); return; }
    if (!data.user) { setErr("Could not create user."); return; }

    const { error: profErr } = await supabase
      .from("user_profiles")
      .insert([{ user_id: data.user.id, org_id: p.org_id, username: u, role }]);
    if (profErr) { setErr(profErr.message); return; }

    setMsg(`Created ${role} user "${u}". Share the username + PIN manually.`);
    setUsername("");
    setPin("");
    await refresh();
  }

  async function removeProfile(user_id: string) {
    setMsg(null);
    setErr(null);
    if (!confirm("Delete this user profile? (This does not delete the auth user.)")) return;
    const { error } = await supabase.from("user_profiles").delete().eq("user_id", user_id);
    if (error) setErr(error.message);
    else setMsg("User removed.");
    await refresh();
  }

  return (
    <div className="grid gap-4">
      <Card title="Create user (Admin only)">
        {msg ? <div className="mb-2 text-sm text-green-700">{msg}</div> : null}
        {err ? <div className="mb-2 text-sm text-red-700">{err}</div> : null}
        <div className="grid md:grid-cols-4 gap-2">
          <div>
            <div className="text-xs text-gray-600 mb-1">Username</div>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="support1" />
            <Hint>Share manually with staff.</Hint>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">PIN</div>
            <Input value={pin} onChange={(e) => setPin(e.target.value)} placeholder="1234" type="password" />
            <Hint>4–10 digits recommended.</Hint>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Role</div>
            <Select value={role} onChange={(e) => setRole(e.target.value as any)}>
              <option value="support">Support</option>
              <option value="admin">Admin</option>
            </Select>
            <Hint>Support: events, check-in, reports.</Hint>
          </div>
          <div className="flex items-end">
            <Button onClick={createUser}>Create</Button>
          </div>
        </div>
      </Card>

      <Card title="Users in your organization">
        {loading ? <div className="text-sm text-gray-600">Loading…</div> : null}
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Username</th>
                <th className="py-2">Role</th>
                <th className="py-2">Created</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className="border-b">
                  <td className="py-2 font-medium">{r.username}</td>
                  <td className="py-2">{r.role}</td>
                  <td className="py-2">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="py-2 text-right">
                    <Button variant="danger" onClick={() => removeProfile(r.user_id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="py-3 text-gray-600" colSpan={4}>
                    No users yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
