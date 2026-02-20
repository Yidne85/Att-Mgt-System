"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { Button, Card, Input, Hint } from "../../../components/ui";

type TypeRow = {
  id: string;
  name: string;
  points: number;
  start_minute: number;
  end_minute: number | null;
  org_id: string;
};

function toInt(v: string, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export default function TypesPage() {
  const [orgId, setOrgId] = useState<string>("");
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [name, setName] = useState("");
  const [points, setPoints] = useState("1");
  const [startMin, setStartMin] = useState("0");
  const [endMin, setEndMin] = useState("15"); // empty = open-ended

  const sorted = useMemo(() => {
    return [...types].sort((a, b) => (a.start_minute - b.start_minute) || a.name.localeCompare(b.name));
  }, [types]);

  async function load() {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) { window.location.href = "/login"; return; }
    const userId = sess.session.user.id;
    const { data: org } = await supabase.from("orgs").select("*").eq("owner_user_id", userId).single();
    setOrgId(org.id);
    const { data } = await supabase.from("attendance_types").select("*").eq("org_id", org.id);
    setTypes((data ?? []) as TypeRow[]);
  }

  useEffect(() => { load(); }, []);

  async function addType() {
    if (!orgId || !name.trim()) return;
    const p = Number(points);
    const s = toInt(startMin, 0);
    const e = endMin.trim() ? toInt(endMin, s) : null;
    if (e !== null && e <= s) { alert("End minute must be greater than start minute (or leave it blank)." ); return; }

    const { error } = await supabase.from("attendance_types").insert({
      org_id: orgId,
      name: name.trim().toLowerCase(),
      points: Number.isFinite(p) ? p : 0,
      start_minute: s,
      end_minute: e,
    });

    if (error) { alert(error.message); return; }
    setName("");
    setPoints("1");
    setStartMin("0");
    setEndMin("15");
    await load();
  }

  async function saveType(row: TypeRow) {
    const { error } = await supabase.from("attendance_types").update({
      name: row.name.trim().toLowerCase(),
      points: row.points,
      start_minute: row.start_minute,
      end_minute: row.end_minute,
    }).eq("id", row.id);

    if (error) { alert(error.message); return; }
    await load();
  }

  async function deleteType(id: string) {
    if (!confirm("Delete this attendance type?")) return;
    const { error } = await supabase.from("attendance_types").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    await load();
  }

  return (
    <div className="grid gap-4">
      <Card title="Attendance types, points, and time windows">
        <div className="grid gap-2 max-w-3xl">
          <div className="grid sm:grid-cols-5 gap-2">
            <Input placeholder="Type name (present/late/absent)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Points" value={points} onChange={(e) => setPoints(e.target.value)} inputMode="decimal" />
            <Input placeholder="Start min" value={startMin} onChange={(e) => setStartMin(e.target.value)} inputMode="numeric" />
            <Input placeholder="End min (blank=open)" value={endMin} onChange={(e) => setEndMin(e.target.value)} inputMode="numeric" />
            <Button onClick={addType} disabled={!name.trim()}>Add</Button>
          </div>
          <Hint>
            Configure each status window in minutes relative to the event start time. Example: <b>present</b> 0–15, <b>late</b> 15–(blank), <b>absent</b> doesn’t need a window (it’s used when no check-in exists).
          </Hint>

          <div className="mt-2 overflow-auto border rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">Type</th>
                  <th className="text-left p-2">Points</th>
                  <th className="text-left p-2">Start min</th>
                  <th className="text-left p-2">End min</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => (
                  <TypeRowEditor
                    key={t.id}
                    row={t}
                    onSave={saveType}
                    onDelete={deleteType}
                  />
                ))}
                {sorted.length === 0 ? (
                  <tr><td className="p-2 text-gray-600" colSpan={5}>No types yet.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <Hint>
            Tip: If you change time windows, new check-ins will follow the new rules (existing records keep their saved status).
          </Hint>
        </div>
      </Card>
    </div>
  );
}

function TypeRowEditor({
  row,
  onSave,
  onDelete,
}: {
  row: TypeRow;
  onSave: (row: TypeRow) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState(row.name);
  const [points, setPoints] = useState(String(row.points));
  const [startMin, setStartMin] = useState(String(row.start_minute));
  const [endMin, setEndMin] = useState(row.end_minute === null ? "" : String(row.end_minute));
  const [busy, setBusy] = useState(false);

  return (
    <tr className="border-t">
      <td className="p-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </td>
      <td className="p-2">
        <Input value={points} onChange={(e) => setPoints(e.target.value)} inputMode="decimal" />
      </td>
      <td className="p-2">
        <Input value={startMin} onChange={(e) => setStartMin(e.target.value)} inputMode="numeric" />
      </td>
      <td className="p-2">
        <Input value={endMin} onChange={(e) => setEndMin(e.target.value)} inputMode="numeric" placeholder="(blank=open)" />
      </td>
      <td className="p-2">
        <div className="flex gap-2">
          <Button
            onClick={async () => {
              const p = Number(points);
              const s = toInt(startMin, 0);
              const e = endMin.trim() ? toInt(endMin, s) : null;
              if (e !== null && e <= s) { alert("End minute must be greater than start minute (or leave it blank)." ); return; }

              setBusy(true);
              await onSave({
                ...row,
                name: name.trim().toLowerCase(),
                points: Number.isFinite(p) ? p : 0,
                start_minute: s,
                end_minute: e,
              });
              setBusy(false);
            }}
            disabled={busy || !name.trim()}
          >
            Save
          </Button>
          <Button variant="secondary" onClick={() => onDelete(row.id)} disabled={busy}>
            Delete
          </Button>
        </div>
      </td>
    </tr>
  );
}
