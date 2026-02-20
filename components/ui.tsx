export function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-xl shadow-sm p-4">
      {title ? <div className="font-semibold mb-3">{title}</div> : null}
      {children}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200 " +
        (props.className ?? "")
      }
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={
        "w-full border rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-200 " +
        (props.className ?? "")
      }
    />
  );
}

export function Button({
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium border shadow-sm disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
      : variant === "secondary"
        ? "bg-white text-gray-900 border-gray-300 hover:bg-gray-50"
        : "bg-red-600 text-white border-red-600 hover:bg-red-700";
  return <button {...props} className={`${base} ${styles} ${props.className ?? ""}`} />;
}

export function Hint({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-gray-500 mt-1">{children}</div>;
}
