import React, { useState, useCallback } from "react";
import { Shield, Search, X, Clock, User, FileText, Trash2, Upload, Database, AlertTriangle, RefreshCw } from "lucide-react";
import { apiFetch } from "../lib/api-client";

interface AuditEntry {
  userId: string;
  userEmail: string;
  action: string;
  patientId: string | null;
  detail: string | null;
  timestamp: string;
}

const actionMeta: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  "auth.failed":         { label: "Auth Failed",       icon: AlertTriangle, color: "#EF4444" },
  "patient.create":      { label: "Patient Created",   icon: FileText,      color: "#10B981" },
  "patient.update":      { label: "Patient Updated",   icon: FileText,      color: "#3B82F6" },
  "patient.soft_delete": { label: "Patient Deleted",   icon: Trash2,        color: "#F59E0B" },
  "patient.permanent_delete": { label: "Permanently Deleted", icon: Trash2, color: "#EF4444" },
  "patient.restore":     { label: "Patient Restored",  icon: FileText,      color: "#8B5CF6" },
  "trash.clear_all":     { label: "Trash Emptied",     icon: Trash2,        color: "#EF4444" },
  "file.upload":         { label: "File Uploaded",     icon: Upload,        color: "#06B6D4" },
  "database.wipe":       { label: "Database Wiped",    icon: Database,      color: "#DC2626" },
};

function actionLabel(action: string) {
  return actionMeta[action]?.label || action;
}
function actionIcon(action: string) {
  return actionMeta[action]?.icon || Shield;
}
function actionColor(action: string) {
  return actionMeta[action]?.color || "#6B7280";
}

export default function AuditLogView() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [loadedCount, setLoadedCount] = useState(0);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter) params.set("action", actionFilter);
      params.set("limit", "500");
      const res = await apiFetch(`/api/audit-logs?${params}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setLogs(data.logs || []);
      setLoadedCount(data.logs?.length || 0);
    } catch (e) {
      console.error("Failed to fetch audit logs:", e);
      setLogs([]);
      setLoadedCount(0);
    } finally {
      setLoading(false);
    }
  }, [actionFilter]);

  const uniqueActions = [...new Set(logs.map(l => l.action))].sort();

  const filtered = logs.filter(l =>
    !filter || l.userEmail?.toLowerCase().includes(filter.toLowerCase()) ||
    l.userId?.toLowerCase().includes(filter.toLowerCase()) ||
    l.patientId?.toLowerCase().includes(filter.toLowerCase()) ||
    l.detail?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: "#6366F1" }}>
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-theme-on-accent tracking-tight">Audit Log</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Chronological record of all security-sensitive operations</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Search by user, patient, detail..."
            className="w-full pl-9 pr-3 py-2 bg-theme-surface dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-200"
          />
          {filter && (
            <button onClick={() => setFilter("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="px-3 py-2 bg-theme-surface dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
        >
          <option value="">All Actions</option>
          {uniqueActions.map(a => (
            <option key={a} value={a}>{actionLabel(a)}</option>
          ))}
        </select>
        <button
          onClick={fetchLogs}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 text-xs font-bold transition-colors"
          title="Load audit log"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Loading..." : "Run"}
        </button>
        {loadedCount > 0 && (
          <span className="text-[11.5px] text-slate-500 font-semibold">{loadedCount} entries loaded</span>
        )}
      </div>

      {/* Log Table */}
      <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-2xl bg-theme-surface dark:bg-slate-900/50">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-xs text-slate-400">Loading audit log...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Shield className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-xs font-semibold">No audit entries found</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="h-table-col">
                <th className="p-3">Timestamp</th>
                <th className="p-3">Action</th>
                <th className="p-3">User</th>
                <th className="p-3">Patient ID</th>
                <th className="p-3">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((entry, i) => {
                const Icon = actionIcon(entry.action);
                const color = actionColor(entry.action);
                return (
                  <tr key={`${entry.timestamp}-${i}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {new Date(entry.timestamp).toLocaleString()}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11.5px] font-bold whitespace-nowrap"
                        style={{ backgroundColor: color + "18", color }}>
                        <Icon className="h-3 w-3" />
                        {actionLabel(entry.action)}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3 text-slate-400" />
                        <span className="text-slate-700 dark:text-slate-300">{entry.userEmail || entry.userId}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <code className="text-slate-600 dark:text-slate-400 font-mono text-[11.5px]">{entry.patientId || "—"}</code>
                    </td>
                    <td className="p-3 text-slate-500 dark:text-slate-400 max-w-[250px] truncate" title={entry.detail || ""}>
                      {entry.detail || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-3 text-[11.5px] text-slate-400 text-center">{filtered.length} entries shown</p>
    </div>
  );
}
