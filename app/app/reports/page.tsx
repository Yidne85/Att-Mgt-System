"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { requireProfile, UserProfile } from "../../../lib/profile";
import { Button, Card, Input, Select, Hint } from "../../../components/ui";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type ClassRow = { id: string; name: string };
type ReportRow = { student_id: string; full_name: string; points_sum: number; total_events: number; date_range: string };
type DetailRow = { full_name: string; status: string; checked_in_at: string; event_title: string; starts_at: string };

export default function ReportsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [types, setTypes] = useState<{id:string;name:string}[]>([]);
  const [classId, setClassId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<string>("");
  const [studentName, setStudentName] = useState<string>("");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [detailRows, setDetailRows] = useState<DetailRow[]>([]);

  async function loadBasics() {
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) { window.location.href = "/login"; return; }
  const p = await requireProfile();
  setProfile(p);

  const { data: org } = await supabase.from("orgs").select("*").eq("id", p.org_id).single();

  const { data: cls } = await supabase.from("classes").select("*").eq("org_id", org?.id).order("name");
  setClasses((cls as any) ?? []);

  const { data: t } = await supabase.from("attendance_types").select("id,name").eq("org_id", org?.id).order("name");
  setTypes((t as any) ?? []);
}

useEffect(() => { loadBasics(); }, []);

  
function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportCsvPoints() {
  const header = ["Student name", "Total events", "Points", "Date range"];

  const lines = [header.join(",")].concat(
    rows.map((r) =>
      [r.full_name, String(r.total_events), String(r.points_sum), r.date_range]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
  );

  const BOM = "\ufeff"; // 👈 IMPORTANT FOR AMHARIC
  downloadBlob(
    "points-summary.csv",
    new Blob([BOM + lines.join("\n")], { type: "text/csv;charset=utf-8" })
  );
}

function exportXlsxPoints() {
  const ws = XLSX.utils.json_to_sheet(
    rows.map((r) => ({
      "Student name": r.full_name,
      "Total events": r.total_events,
      Points: Number(r.points_sum.toFixed(2)),
      "Date range": r.date_range,
    }))
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Points Summary");
  XLSX.writeFile(wb, "points-summary.xlsx");
}

function exportPdfPoints() {
  const doc = new jsPDF();
  doc.text("Points Summary", 14, 14);
  autoTable(doc, {
    startY: 20,
    head: [["Student name", "Total events", "Points", "Date range"]],
    body: rows.map((r) => [r.full_name, r.total_events, r.points_sum.toFixed(2), r.date_range]),
  });
  doc.save("points-summary.pdf");
}

function exportCsvDetails() {
  const header = ["Student name", "Attendance type", "Entry time", "Event title", "Event start"];
  const lines = [header.join(",")].concat(
    detailRows.map((r) =>
      [r.full_name, r.status, r.checked_in_at, r.event_title, r.starts_at]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
  );
  downloadBlob("attendance-details.csv", new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
}

function exportXlsxDetails() {
  const ws = XLSX.utils.json_to_sheet(
    detailRows.map((r) => ({
      "Student name": r.full_name,
      "Attendance type": r.status,
      "Entry time": r.checked_in_at,
      "Event title": r.event_title,
      "Event start": r.starts_at,
    }))
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Attendance Details");
  XLSX.writeFile(wb, "attendance-details.xlsx");
}

function exportPdfDetails() {
  const doc = new jsPDF();
  doc.text("Attendance Details", 14, 14);
  autoTable(doc, {
    startY: 20,
    head: [["Student name", "Attendance type", "Entry time", "Event title", "Event start"]],
    body: detailRows.map((r) => [r.full_name, r.status, r.checked_in_at, r.event_title, r.starts_at]),
    styles: { fontSize: 8 },
  });
  doc.save("attendance-details.pdf");
}

async function runPointsReport() {
  if (!classId || !from) { alert("Select class and FROM date"); return; }
  const toVal = to || new Date().toISOString().slice(0,10);
  const fromIso = new Date(from).toISOString();
  const toIso = new Date(toVal).toISOString();

  const { data, error } = await supabase
    .from("points_report_view")
    .select("*")
    .eq("class_id", classId)
    .gte("starts_at", fromIso)
    .lte("starts_at", toIso);

  if (error) { alert(error.message); return; }

  const agg = new Map<string, { student_id: string; full_name: string; points_sum: number; events: Set<string> }>();
  for (const r of (data ?? []) as any[]) {
    const key = r.student_id;
    const cur = agg.get(key) ?? { student_id: key, full_name: r.full_name, points_sum: 0, events: new Set<string>() };
    cur.points_sum += Number(r.points ?? 0);
    cur.events.add(String(r.event_id));
    agg.set(key, cur);
  }

  const out = Array.from(agg.values()).map(v => ({
    student_id: v.student_id,
    full_name: v.full_name,
    points_sum: v.points_sum,
    total_events: v.events.size,
    date_range: `${from} → ${toVal}`,
  }));

  out.sort((a,b) => sortDir === "desc" ? b.points_sum - a.points_sum : a.points_sum - b.points_sum);
  setRows(out as any);
}


  async function runAttendanceDetail() {
  if (!classId || !from) { alert("Select class and FROM date"); return; }
  const toVal = to || new Date().toISOString().slice(0,10);
  const fromIso = new Date(from).toISOString();
  const toIso = new Date(toVal).toISOString();

  let q = supabase
    .from("attendance_detail_view")
    .select("*")
    .eq("class_id", classId)
    .gte("starts_at", fromIso)
    .lte("starts_at", toIso);

  if (status) q = q.eq("status", status);
  if (studentName.trim()) q = q.ilike("full_name", `%${studentName.trim()}%`);

  const { data, error } = await q;
  if (error) { alert(error.message); return; }
  setDetailRows((data as any) ?? []);
}


  return (
    <div className="grid gap-4">
      <Card title="Filters">
        <div className="grid gap-3 max-w-3xl">
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium">Class</label>
              <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">-- choose --</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Sort points</label>
              <Select value={sortDir} onChange={(e) => setSortDir(e.target.value as any)}>
                <option value="desc">Highest → Lowest</option>
                <option value="asc">Lowest → Highest</option>
              </Select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">To (optional)</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Attendance type</label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All</option>
                {types.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                <option value="absent">absent</option>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Student name</label>
              <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Search..." />
            </div>
          </div>

          <Hint>
            Use the same date range filters for both reports below.
          </Hint>
        </div>
      </Card>

      <Card title="Points summary (sum per student)">
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={runPointsReport}>Run report</Button>
            <Button variant="secondary" onClick={exportCsvPoints} disabled={rows.length === 0}>Export CSV</Button>
            <Button variant="secondary" onClick={exportXlsxPoints} disabled={rows.length === 0}>Export Excel</Button>
            <Button variant="secondary" onClick={exportPdfPoints} disabled={rows.length === 0}>Export PDF</Button>
          </div>

          <div className="overflow-auto border rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr><th className="text-left p-2">Student</th><th className="text-left p-2">Points</th></tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.student_id} className="border-t">
                    <td className="p-2">{r.full_name}</td>
                    <td className="p-2">{r.points_sum}</td>
                  </tr>
                ))}
                {rows.length === 0 ? <tr><td className="p-2 text-gray-600" colSpan={2}>No results yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <Card title="Attendance summary (by date range)">
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={runAttendanceDetail}>Load attendance</Button>
            <Button variant="secondary" onClick={exportCsvDetails} disabled={detailRows.length === 0}>Export CSV</Button>
            <Button variant="secondary" onClick={exportXlsxDetails} disabled={detailRows.length === 0}>Export Excel</Button>
            <Button variant="secondary" onClick={exportPdfDetails} disabled={detailRows.length === 0}>Export PDF</Button>
          </div>

          <div className="overflow-auto border rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">Event</th>
                  <th className="text-left p-2">Start</th>
                  <th className="text-left p-2">Student</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Entry time</th>
                </tr>
              </thead>
              <tbody>
                {detailRows.map((r, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-2">{r.event_title}</td>
                    <td className="p-2">{new Date(r.starts_at).toLocaleString()}</td>
                    <td className="p-2">{r.full_name}</td>
                    <td className="p-2">{r.status}</td>
                    <td className="p-2">{new Date(r.checked_in_at).toLocaleTimeString()}</td>
                  </tr>
                ))}
                {detailRows.length === 0 ? <tr><td className="p-2 text-gray-600" colSpan={5}>No results yet.</td></tr> : null}
              </tbody>
            </table>
          </div>

          <Hint>
            Note: This list includes students who checked in. Students who never checked in are counted as <b>absent</b> in the points report.
          </Hint>
        </div>
      </Card>
    </div>
  );
}

function escapeCsv(v: any) {
  const s = String(v ?? "");
  if (/[\n\r,\"]/.test(s)) return '"' + s.replace(/\"/g, '""') + '"';
  return s;
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}
