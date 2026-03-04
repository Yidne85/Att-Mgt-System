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
        "focus:bg-brand focus:border-slate-300 focus:ring-4 focus:ring-brand-500/10 " +
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
        "focus:bg-white focus:border-slate-300 focus:ring-4 focus:ring-brand-500/10 " +
        "disabled:opacity-60 disabled:cursor-not-allowed " +
        className
      }
    />
  );
}

https://coinpayments.testrail.io/index.php?/runs/view/901&group_by=cases:section_id&group_order=asc&display=tree
