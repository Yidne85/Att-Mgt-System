import Link from "next/link";

export default function Home() {
  return (
    <div className="grid gap-4">
      <div className="bg-white border rounded-xl shadow-sm p-6">
        <h1 className="text-xl font-semibold mb-2">Attendance QR</h1>
        <p className="text-sm text-gray-600">
          Manage classes, students, events, and collect attendance using QR codes from a phone camera.
        </p>
        <div className="mt-4 flex gap-3">
          <Link className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium" href="/login">
            Admin Login
          </Link>
          <Link className="px-3 py-2 rounded-lg border text-sm font-medium" href="/register">
            Create Admin Account
          </Link>
        </div>
      </div>
      <div className="text-sm text-gray-600">
        Tip: After deployment, open <span className="font-mono">/checkin</span> on your phone for scanning.
      </div>
    </div>
  );
}
