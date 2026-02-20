"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import { Button, Card, Input, Select, Hint } from "../../../../components/ui";

type StudentRow = { id: string; full_name: string; gender: string; student_uid: string; qr_data_url: string | null; class_id: string };

export default function StudentProfile({ params }: { params: { id: string } }) {
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("unknown");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data, error } = await supabase.from("students").select("*").eq("id", params.id).single();
    if (error) { alert(error.message); return; }
    setStudent(data as any);
    setFullName((data as any)?.full_name ?? "");
    setGender((data as any)?.gender ?? "unknown");
  }

  useEffect(() => { load(); }, [params.id]);

  function downloadQr() {
    if (!student?.qr_data_url) return;
    const a = document.createElement("a");
    a.href = student.qr_data_url;
    a.download = `${(student.full_name ?? "student").replace(/\s+/g, "_")}_qr.png`;
    a.click();
  }

  async function shareQr() {
    if (!student?.qr_data_url) return;
    try {
      const res = await fetch(student.qr_data_url);
      const blob = await res.blob();
      const file = new File([blob], "qr.png", { type: blob.type });
      // @ts-ignore
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        // @ts-ignore
        await navigator.share({ title: "Student QR", text: student.full_name, files: [file] });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert("Share not supported on this device. Link copied instead.");
      }
    } catch {
      await navigator.clipboard.writeText(window.location.href);
      alert("Could not share file. Link copied instead.");
    }
  }

  async function saveStudent() {
    if (!student) return;
    if (!fullName.trim()) { alert("Full name is required."); return; }
    setBusy(true);
    const { error } = await supabase.from("students").update({
      full_name: fullName.trim(),
      gender,
    }).eq("id", student.id);
    setBusy(false);
    if (error) { alert(error.message); return; }
    await load();
    alert("Student updated.");
  }

  async function deleteStudent() {
    if (!student) return;
    if (!confirm("Delete this student?")) return;
    setBusy(true);
    const { error } = await supabase.from("students").delete().eq("id", student.id);
    setBusy(false);
    if (error) { alert(error.message); return; }
    window.location.href = "/app/classes";
  }

  return (
    <div className="grid gap-4">
      <Card title="Student profile">
        {!student ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4 items-start">
            <div className="grid gap-3 text-sm">
              <div>
                <label className="text-sm font-medium">Full name</label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>

              <div>
                <label className="text-sm font-medium">Gender</label>
                <Select value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="male">male</option>
                  <option value="female">female</option>
                  <option value="other">other</option>
                  <option value="unknown">unknown</option>
                </Select>
              </div>

              <div><span className="text-gray-600">Student UID:</span> <span className="font-mono">{student.student_uid}</span></div>

              <div className="flex flex-wrap gap-2 mt-1">
                <Button onClick={saveStudent} disabled={busy || !fullName.trim()}>Save</Button>
                <Button variant="secondary" onClick={deleteStudent} disabled={busy}>Delete</Button>
              </div>

              <div className="flex flex-wrap gap-2 mt-2">
                <Button onClick={downloadQr} disabled={!student.qr_data_url}>Download QR</Button>
                <Button variant="secondary" onClick={shareQr} disabled={!student.qr_data_url}>Share</Button>
              </div>

              <Hint>
                You can share the link to this page to share the student QR code.
              </Hint>
            </div>

            <div className="bg-gray-50 border rounded-xl p-4 flex justify-center">
              {student.qr_data_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="QR code" src={student.qr_data_url} className="w-56 h-56" />
              ) : (
                <div className="text-sm text-gray-600">No QR available.</div>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card title="How it works">
        <div className="text-sm text-gray-600">
          This QR encodes the student UID. During check-in, the app scans it and records the entry time for the selected event.
        </div>
      </Card>
    </div>
  );
}
