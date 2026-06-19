/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  UserPlus, 
  Search, 
  Settings, 
  ArrowRight, 
  Eye, 
  Edit, 
  Trash2, 
  Inbox, 
  Activity,
  Calendar,
  Clock,
  Users,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { PatientRecord, UserAccount } from "../types";

interface HomeViewProps {
  currentUser: UserAccount;
  allPatients: PatientRecord[];
  onNavigateMenu: (menu: "Home" | "Dashboard" | "Add Patient" | "Search Records" | "Settings") => void;
  onViewPatient: (patient: PatientRecord) => void;
  onEditPatient: (patient: PatientRecord) => void;
  onDeletePatient: (id: string, patient?: PatientRecord) => void;
  activeCount?: number;
  deletedCount?: number;
  onRefreshCounts?: () => void;
  onLoadRecentRecords: () => void;
  recentRecordsLoading?: boolean;
  recentRecordsLoaded?: boolean;
}

export default function HomeView({ 
  currentUser, 
  allPatients, 
  onNavigateMenu, 
  onViewPatient, 
  onEditPatient, 
  onDeletePatient,
  activeCount,
  deletedCount,
  onRefreshCounts,
  onLoadRecentRecords,
  recentRecordsLoading = false,
  recentRecordsLoaded = false,
}: HomeViewProps) {

  const [now, setNow] = useState(new Date());
  const [recentSectionOpen, setRecentSectionOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Time oriented greeting logic
  const getGreeting = () => {
    const hour = now.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Sort by updatedAt descending to show the most recent 50 records
  const recentRecords = [...allPatients]
    .sort((a, b) => {
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tb - ta;
    });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-750 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900";
      case "under_treatment":
        return "bg-natural-brown/10 dark:bg-natural-brown/20 text-natural-brown dark:text-natural-gold border border-natural-brown/30 dark:border-natural-brown/50";
      case "follow_up":
        return "bg-natural-accent/10 dark:bg-natural-accent/20 text-natural-accent-dark dark:text-natural-hover border border-natural-accent/30 dark:border-natural-accent/50";
      case "discharged":
        return "bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800";
      default:
        return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400";
    }
  };

  return (
    <div className="space-y-6 page-fade-in">

      {/* Greetings Header Jumbotron */}
      <div className="p-6 lg:p-8 text-slate-800 dark:text-theme-on-accent hero-fade-up relative overflow-hidden">
        <div className="max-w-3xl w-full text-left">
          <span className="eyebrow px-3 py-1 rounded-full bounce-in inline-block text-xs font-semibold text-white" style={{ backgroundColor: "#10B981" }}>
            Clinical Portal Active
          </span>
          <h2 className="text-3xl lg:text-4xl font-bold mt-4 tracking-tight hero-fade-up" style={{ animationDelay: "0.2s" }}>
            {getGreeting()}, {currentUser.name}
          </h2>

          <div className="mt-8 flex flex-col gap-3 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span>{now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span>{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Kolkata' })} GMT+5:30</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              {activeCount !== undefined ? (
                <span>Active: {activeCount} · Deleted: {deletedCount ?? 0} · Total: {activeCount + (deletedCount ?? 0)}</span>
              ) : (
                <span className="text-slate-400">Record counts —</span>
              )}
              <button
                onClick={onRefreshCounts}
                className="ml-1 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Refresh patient counts"
              >
                <RefreshCw className="h-3.5 w-3.5 text-slate-400 hover:text-natural-accent" />
              </button>
            </div>

          </div>

        </div>
      </div>

      <div className="w-full px-6 text-left lg:px-8">
        <h3 className="text-base font-bold text-slate-800 dark:text-theme-on-accent mb-3">Quick Navigation Shortcuts</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">

          {([
             {
               id: "shortcut-add-patient",
               title: "Add Patient",
               icon: UserPlus,
               target: "Add Patient" as const,
               color: "#2563EB",
             },
             {
               id: "shortcut-search",
               title: "Search Records",
               icon: Search,
               target: "Search Records" as const,
               color: "#2563EB",
             },
             {
               id: "shortcut-dashboard",
               title: "View Dashboard",
               icon: Activity,
               target: "Dashboard" as const,
               color: "#3B82F6",
             },
             {
               id: "shortcut-settings",
               title: "System Settings",
               icon: Settings,
               target: "Settings" as const,
               color: "#2563EB",
             },
           ]).map((s) => {

            const Icon = s.icon;
            return (
              <button
                key={s.id}
                id={s.id}
                onClick={() => onNavigateMenu(s.target)}
                className="shortcut-card relative grid min-h-32 h-full w-full grid-rows-[2.5rem_1fr] items-start p-5 pr-12 minimal-card rounded-2xl text-left cursor-pointer"
              >
                <span className="shortcut-card-arrow" aria-hidden="true">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
                <div className="shortcut-card-icon h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: s.color + "18", color: s.color }}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex h-full items-end pt-5">
                  <h4 className="shortcut-card-title w-full text-left font-bold text-slate-800 dark:text-theme-on-accent text-sm leading-tight">
                    {s.title}
                  </h4>
                </div>
              </button>
            );
          })}

        </div>
      </div>

      {/* Recent Entered Records */}
      <div className="mx-6 minimal-card rounded-2xl overflow-hidden lg:mx-8">
        <div className="p-5 border-b border-natural-border flex justify-between items-center bg-theme-surface dark:bg-theme-surface">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-theme-on-accent">Recently Admitted/Updated Patients</h3>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setRecentSectionOpen((open) => !open)}
              className="inline-flex items-center gap-2 border border-natural-border bg-theme-surface hover:border-natural-accent dark:bg-slate-900 text-slate-700 dark:text-slate-250 px-3 py-2 rounded-xl text-xs font-semibold transition"
              aria-expanded={recentSectionOpen}
            >
              {recentSectionOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <span>{recentSectionOpen ? "Hide" : "Show"}</span>
            </button>
            <button
              id="btn-load-recent-patients"
              type="button"
              onClick={onLoadRecentRecords}
              disabled={recentRecordsLoading}
              className="inline-flex items-center gap-2 bg-natural-accent hover:bg-natural-accent-dark disabled:opacity-60 text-theme-on-accent px-3 py-2 rounded-xl text-xs font-semibold transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${recentRecordsLoading ? "animate-spin" : ""}`} />
              <span>{recentRecordsLoading ? "Loading..." : "Recent 50"}</span>
            </button>
            <button
              id="btn-view-all-patients"
              onClick={() => onNavigateMenu("Search Records")}
              className="text-xs font-semibold text-natural-accent dark:text-natural-gold hover:text-natural-accent-dark dark:hover:text-theme-on-accent hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Search records</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {recentSectionOpen && (recentRecordsLoading ? (
          <div className="py-12 p-5 text-center">
            <div className="h-8 w-8 mx-auto rounded-full border-2 border-natural-accent border-t-transparent animate-spin"></div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 font-semibold">Loading recent records...</p>
          </div>
        ) : !recentRecordsLoaded ? (
          <div className="py-12 p-5 text-center">
            <button
              type="button"
              onClick={onLoadRecentRecords}
              className="inline-flex items-center gap-2 bg-natural-accent hover:bg-natural-accent-dark text-theme-on-accent px-4 py-2.5 rounded-xl text-xs font-bold transition"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Load recent 50 records</span>
            </button>
          </div>
        ) : recentRecords.length === 0 ? (
          <div className="py-12 p-5 text-center">
            <div className="flex justify-center text-slate-300 dark:text-slate-650 mb-3">
              <Inbox className="h-12 w-12" />
            </div>
            <h4 className="font-bold text-slate-700 dark:text-slate-300">No Patient Records Yet</h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-sm mx-auto">
              Click the "Add Patient" shortcut aloft or in the menu panel to create your first clinical oncological record.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="h-table-col">
                  <th className="py-3 px-5">Reg ID</th>
                  <th className="py-3 px-5">Patient Name</th>
                  <th className="py-3 px-5">Gender / Age</th>
                  <th className="py-3 px-5">Oncology Category</th>
                  <th className="py-3 px-5">Active Status</th>
                  <th className="py-3 px-5">Last Updated</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-705 text-xs text-slate-600 dark:text-slate-300">
                {recentRecords.map((pat) => {
                  const patientName = [pat.title, pat.first_name, pat.last_name].filter(Boolean).join(" ") || "Unnamed Patient";
                  const oncology = (pat.oncology_types && pat.oncology_types.length > 0 ? pat.oncology_types : [pat.oncology || "Other"]).join(", ");
                  const status = pat.status || "active";
                  const updatedAt = pat.updatedAt ? new Date(pat.updatedAt).toLocaleDateString() : "N/A";

                  return (
                  <tr key={pat.id} className="hover:bg-natural-card/20 dark:hover:bg-slate-750/30 transition-colors">
                    <td className="py-3 px-5 text-slate-650 dark:text-slate-300 font-bold">{pat.auto_id || "PT-N/A"}</td>
                    <td className="py-3 px-5">
                      <span className="font-semibold text-slate-800 dark:text-theme-on-accent capitalize">
                        {patientName}
                      </span>
                    </td>
                    <td className="py-3 px-5 capitalize">{pat.gender || "N/A"} • {pat.age || "N/A"} yrs</td>
                    <td className="py-3 px-5">
                      <span className="bg-natural-accent/10 dark:bg-natural-accent/20 text-natural-accent-dark dark:text-natural-hover font-semibold py-0.5 px-2 rounded-md border border-natural-accent/20">
                        {oncology}
                      </span>
                    </td>
                    <td className="py-3 px-5">
                      <span className={`eyebrow px-2.5 py-0.5 rounded-full ${getStatusBadgeClass(status)}`}>
                        {status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-slate-650 dark:text-slate-300 ">
                      {updatedAt}
                    </td>
                    <td className="py-3 px-5 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        id={`btn-home-view-${pat.id}`}
                        onClick={() => onViewPatient(pat)}
                        className="btn-clr-view inline-flex items-center gap-1 py-1 px-2.5 rounded-lg text-[11.5px] font-semibold transition-colors cursor-pointer"
                        title="View Detailed Dossier"
                      >
                        <Eye className="h-3 w-3" />
                        <span>View</span>
                      </button>
                      <button
                        id={`btn-home-edit-${pat.id}`}
                        onClick={() => onEditPatient(pat)}
                        className="btn-clr-edit inline-flex items-center gap-1 py-1 px-2.5 rounded-lg text-[11.5px] font-semibold transition-colors cursor-pointer"
                        title="Edit Records"
                      >
                        <Edit className="h-3 w-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        id={`btn-home-delete-${pat.id}`}
                        onClick={() => onDeletePatient(pat.id, pat)}
                        className="btn-clr-delete inline-flex items-center gap-1 py-1 px-2.5 rounded-lg text-[11.5px] font-semibold transition-colors cursor-pointer"
                        title="Delete Patient Record"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Delete</span>
                      </button>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        ))}
      </div>

    </div>
  );
}
