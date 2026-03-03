"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { requireProfile } from "../../../lib/profile";
import { Button, Card, Input, Select, Hint } from "../../../components/ui";

type ClassRow = { id: string; name: string };
type EventRow = { id: string; title: string; starts_at: string; ends_at: string; class_id: string };

export default function EventsPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);

  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const className = useMemo(() => classes.find((c) => c.id === classId)?.name ?? "", [classes, classId]);

  async function loadAll() {
    setErr("");
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) { window.location.href = "/login"; return; }

    const p = await requireProfile();

    const { data: cls, error: clsErr } = await supabase
      .from("classes")
      .select("id,name")
      .eq("org_id", p.org_id)
      .order("name");

    if (clsErr) { setErr(clsErr.message); return; }
    setClasses((cls as ClassRow[]) ?? []);

    const classIds = ((cls as ClassRow[]) ?? []).map((c) => c.id);
    if (classIds.length === 0) { setEvents([]); return; }

    const { data: ev, error: evErr } = await supabase
      .from("class_events")
      .select("id,title,starts_at,ends_at,class_id")
      .in("class_id", classIds)
      .order("starts_at", { ascending: false });

    if (evErr) { setErr(evErr.message); return; }
    setEvents((ev as EventRow[]) ?? []);
  }

  useEffect(() => { void loadAll(); }, []);

  async function createEvent() {
    setErr(""); setMsg("");
    if (!classId || !startsAt || !endsAt) { setErr("Please select class, start and end."); return; }

    const t = title.trim() || "Class session";

    // Unique event name within the class
    const { data: existing } = await supabase
      .from("class_events")
      .select("id")
      .eq("class_id", classId)
      .ilike("title", t)
      .limit(1);

    if (existing && existing.length > 0) {
      setErr("Event name already exists for this class. Please use a different name.");
      return;
    }

    const startsIso = new Date(startsAt).toISOString();
    const endsIso = new Date(endsAt).toISOString();
    if (new Date(endsIso).getTime() <= new Date(startsIso).getTime()) {
      setErr("End date/time must be after start date/time.");
      return;
    }

    const { error } = await supabase.from("class_events").insert({
      class_id: classId,
      title: t,
      starts_at: startsIso,
      ends_at: endsIso,
    });

    if (error) { setErr(error.message); return; }
    setMsg("Saved.");
    setTitle("");
    await loadAll();
  }

  async function deleteEvent(id: string) {
    if (!confirm("Delete this event?")) return;
    const { error } = await supabase.from("class_events").delete().eq("id", id);
    if (error) { setErr(error.message); return; }
    setMsg("Deleted.");
    await loadAll();
  }

  return (
    <div className="grid gap-4">
      <Card title="Create class event">
        <div className="grid gap-3 max-w-3xl">
          {err ? <div className="text-sm p-3 rounded-lg border bg-rose-50 text-rose-700">{err}</div> : null}
          {msg ? <div className="text-sm p-3 rounded-lg border bg-emerald-50 text-emerald-700">{msg}</div> : null}

          <div className="grid md:grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium">Class</label>
              <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">-- choose --</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Event name</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lesson 1" />
              <Hint>Event name must be unique per class.</Hint>
            </div>
            <div>
              <label className="text-sm font-medium">Start date & time</label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">End date & time</label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={createEvent} disabled={!classId || !startsAt || !endsAt}>Create</Button>
          </div>
        </div>
      </Card>

      <Card title={className ? `Events for ${className}` : "Events"}>
        <div className="overflow-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Class</th>
                <th className="text-left p-2">Event</th>
                <th className="text-left p-2">Starts</th>
                <th className="text-left p-2">Ends</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events
                .filter((e) => (classId ? e.class_id === classId : true))
                .map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="p-2">{classes.find((c) => c.id === e.class_id)?.name ?? "—"}</td>
                  <td className="p-2">{e.title}</td>
                  <td className="p-2">{new Date(e.starts_at).toLocaleString()}</td>
                  <td className="p-2">{new Date(e.ends_at).toLocaleString()}</td>
                  <td className="p-2">
                    <Button variant="secondary" onClick={() => deleteEvent(e.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
              {events.length === 0 ? <tr><td className="p-2 text-gray-600" colSpan={5}>No events yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
