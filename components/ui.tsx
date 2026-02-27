import React from "react";

export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={"bg-white/90 backdrop-blur border border-slate-200 rounded-2xl shadow-sm p-5 md:p-6 " + className}>
      {title ? <div className="font-semibold text-slate-900 mb-4 text-base md:text-lg">{title}</div> : null}
      {children}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input
      {...rest}
      className={
        "w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50/80 text-slate-900 " +
        "placeholder:text-slate-400 outline-none transition " +
        "focus:bg-white focus:border-slate-300 focus:ring-4 focus:ring-blue-500/10 " +
        "disabled:opacity-60 disabled:cursor-not-allowed " +
        className
      }
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", ...rest } = props;
  return (
    <select
      {...rest}
      className={
        "w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50/80 text-slate-900 outline-none transition " +
        "focus:bg-white focus:border-slate-300 focus:ring-4 focus:ring-blue-500/10 " +
        "disabled:opacity-60 disabled:cursor-not-allowed " +
        className
      }
    />
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
}) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold " +
    "transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed";

  const styles =
    variant === "primary"
      ? "bg-brand text-white shadow-sm hover:bg-brand-dark focus:outline-none focus:ring-4 focus:ring-brand/30"
      : variant === "secondary"
        ? "bg-white text-brand border border-brand shadow-sm hover:bg-brand/10 focus:outline-none focus:ring-4 focus:ring-brand/20"
        : "bg-red-700 text-white shadow-sm hover:bg-red-800 focus:outline-none focus:ring-4 focus:ring-red-600/30";

  return <button {...props} className={`${base} ${styles} ${className}`} />;
}
export function Hint({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-slate-500 mt-1">{children}</div>;
}
