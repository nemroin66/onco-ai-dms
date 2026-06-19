import React from "react";
import { CirclePlus, Trash } from "lucide-react";

export type SubTableProps = {
  title: string;
  accent: string;
  icon: React.ComponentType<{ className?: string }>;
  addLabel: string;
  tableKey: string;
  headers: string[];
  keys: string[];
  placeholders: string[];
  emptyTemplate: Record<string, string>;
  rows: Record<string, any>[];
  onAddRow: (e: React.MouseEvent) => void;
  onRemoveRow: (index: number) => void;
  onTableChange: (index: number, field: string, value: any) => void;
};

const SubTable = ({ title, accent, icon: Icon, addLabel, tableKey, headers, keys, placeholders, emptyTemplate, rows, onAddRow, onRemoveRow, onTableChange }: SubTableProps) => (
  <div data-table-key={tableKey}>
    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/30 p-2.5 pl-3 rounded-xl">
      <div className="flex items-center gap-3">
        <span className="h-6 w-6 rounded-md bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 flex-shrink-0">
          <Icon className="h-3 w-3" />
        </span>
        <span className="h-subsection">
          {title}
        </span>
      </div>
      <button
        type="button"
        onClick={onAddRow}
        className="text-[11.5px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
      >
        <CirclePlus className="h-3.5 w-3.5" />
        <span>{addLabel}</span>
      </button>
    </div>
    <div className="mt-2 overflow-x-auto border border-natural-border/50 dark:border-slate-700 rounded-xl">
      <table className="w-full text-left">
        <thead>
          <tr className="h-table-col">
            {headers.map((h, i) => (
              <th key={i} className="p-2 whitespace-nowrap">{h}</th>
            ))}
            <th className="p-2 text-right">Delete</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-natural-border/30 dark:divide-slate-800/20">
          {rows.map((row, idx) => (
            <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
              {keys.map((k, j) => (
                <td key={j} className="p-2">
                  <input
                    type="text"
                    value={row[k] ?? ""}
                    onChange={(e) => onTableChange(idx, k, e.target.value)}
                    placeholder={placeholders[j]}
                    className="w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </td>
              ))}
              <td className="p-2 text-right">
                <button type="button" onClick={() => onRemoveRow(idx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20 transition">
                  <Trash className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={headers.length + 1} className="text-center py-4 text-slate-400 text-[11.5px]">
                No {title.toLowerCase()} entries yet — click "{addLabel}" to begin.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export default SubTable;
