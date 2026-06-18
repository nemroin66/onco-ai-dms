import React from "react";

export const Skeleton: React.FC<{ className?: string; dark?: boolean; style?: React.CSSProperties }> = ({ className = "", dark, style }) => (
  <div className={`skeleton ${dark ? "dark" : ""} ${className}`} style={style} aria-hidden />
);

export const SkeletonText: React.FC<{ lines?: number; className?: string; dark?: boolean }> = ({
  lines = 3,
  className = "",
  dark,
}) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className="h-3"
        dark={dark}
        {...(i === lines - 1 ? {} : { style: { width: `${100 - i * 8}%` } })}
      />
    ))}
  </div>
);

export const SkeletonCard: React.FC<{ className?: string; dark?: boolean }> = ({ className = "", dark }) => (
  <div className={`border border-natural-border dark:border-slate-700/80 rounded-2xl p-5 bg-theme-surface/60 dark:bg-slate-800/30 space-y-3 ${className}`}>
    <div className="flex items-center gap-3">
      <Skeleton className="h-10 w-10 rounded-full" dark={dark} />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/3" dark={dark} />
        <Skeleton className="h-2.5 w-1/3" dark={dark} />
      </div>
    </div>
    <Skeleton className="h-3 w-full" dark={dark} />
    <Skeleton className="h-3 w-5/6" dark={dark} />
    <Skeleton className="h-3 w-4/6" dark={dark} />
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number; cols?: number; className?: string; dark?: boolean }> = ({
  rows = 5,
  cols = 4,
  className = "",
  dark,
}) => (
  <div className={`border border-natural-border dark:border-slate-700/80 rounded-xl overflow-hidden ${className}`}>
    <div className="grid grid-cols-12 gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 border-b border-natural-border dark:border-slate-700">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-3 col-span-3" dark={dark} />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="grid grid-cols-12 gap-2 p-3 border-b border-natural-border/50 dark:border-slate-800/60 last:border-b-0">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton
            key={c}
            className="h-3 col-span-3"
            dark={dark}
            style={{ width: `${60 + ((r + c) % 4) * 10}%` }}
          />
        ))}
      </div>
    ))}
  </div>
);

export const SkeletonPatientCard: React.FC<{ dark?: boolean }> = ({ dark }) => (
  <div className="border border-natural-border dark:border-slate-700/80 rounded-2xl p-5 bg-theme-surface/80 dark:bg-slate-800/40 space-y-3 medical-card">
    <div className="flex items-center gap-3">
      <Skeleton className="h-12 w-12 rounded-full" dark={dark} />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" dark={dark} />
        <Skeleton className="h-2.5 w-1/3" dark={dark} />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" dark={dark} />
    </div>
    <div className="space-y-2">
      <Skeleton className="h-3 w-full" dark={dark} />
      <Skeleton className="h-3 w-2/3" dark={dark} />
    </div>
  </div>
);
