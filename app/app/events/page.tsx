"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { Button, Card, Input, Select, Hint } from "../../../components/ui";

type Org = { id: string };
type ClassRow = { id: string; name: string };
type EventRow = { id: string; class_id: string; title: string; starts_at: string; late_after_minutes: number };

export default function EventsPage() {
  const [org, setOrg] = useState<Org | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("Class session");
  const [startsAt, setStartsAt] = useState("");
  const [lateAfter, setLateAfter] = useState("15");

  const className = useMemo(() => classes.find(c => c.id === classId)?.name ?? "", [classes, classId]);

  async function load() {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) { window.location.href = "/login"; return; }
    const userId = sess.session.user.id;
    const { data: orgRow } = await supabase.from("orgs").select("*").eq("owner_user_id", userId).single();
    setOrg(orgRow);
    const { data: cls } = await supabase.from("classes").select("*").eq("org_id", orgRow.id).order("name");
    setClasses(cls ?? []);
    const { data: ev } = await supabase.from("class_events").select("*").eq("org_id", orgRow.id).order("starts_at", { ascending: false });
    setEvents(ev ?? []);
  }

  useEffect(() => { load(); }, []);

  async function createEvent() {
    if (!org?.id || !classId || !startsAt) return;
    await supabase.from("class_events").insert({
      org_id: org.id,
      class_id: classId,
      title: title.trim() || "Class session",
      starts_at: new Date(startsAt).toISOString(),
      late_after_minutes: Number(lateAfter) || 0
    });
    setTitle("Class session");
    setStartsAt("");
    setLateAfter("15");
    await load();
  }

  return (
    <div className="grid gap-4">
      <Card title="Create class event">
        <div className="grid gap-2 max-w-2xl">
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium">Class</label>
              <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">-- choose --</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Start date & time</label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              <Hint>Used to decide late vs present.</Hint>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Late after (minutes)</label>
              <Input value={lateAfter} onChange={(e) => setLateAfter(e.target.value)} inputMode="numeric" />
            </div>
          </div>
          <Button onClick={createEvent} disabled={!classId || !startsAt}>Create event</Button>
        </div>
      </Card>

      <Card title="Events">
        <div className="overflow-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Title</th>
                <th className="text-left p-2">Class</th>
                <th className="text-left p-2">Starts</th>
                <th className="text-left p-2">Late after</th>
              </tr>
            </thead>
            <tbody>
              {events.map(ev => (
                <tr key={ev.id} className="border-t">
                  <td className="p-2">{ev.title}</td>
                  <td className="p-2">{classes.find(c => c.id === ev.class_id)?.name ?? "—"}</td>
                  <td className="p-2">{new Date(ev.starts_at).toLocaleString()}</td>
                  <td className="p-2">{ev.late_after_minutes} min</td>
                </tr>
              ))}
              {events.length === 0 ? <tr><td className="p-2 text-gray-600" colSpan={4}>No events yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
