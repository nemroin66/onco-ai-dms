/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Search, 
  Eye,
  Edit,
  Trash2,
  Building,
  Phone,
} from "lucide-react";
import { PatientRecord } from "../types";
import { apiFetch } from "../lib/api-client";

interface SearchRecordsViewProps {
  onViewPatient: (pat: PatientRecord) => void;
  onEditPatient: (pat: PatientRecord) => void;
  onDeletePatient: (id: string, patient?: PatientRecord) => void;
}

export default function SearchRecordsView({ 
  onViewPatient, 
  onEditPatient, 
  onDeletePatient,
}: SearchRecordsViewProps) {

  const [pendingSearchQuery, setPendingSearchQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PatientRecord[] | null>(null);
  const [searching, setSearching] = useState(false);
  const patients = searchResults ?? [];

  const handleSearchSubmit = async () => {
    const query = pendingSearchQuery.trim();
    setSearchQuery(query);
    if (!query) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const params = new URLSearchParams({
        search: query,
        includeDeleted: "false",
        limit: "100",
      });
      const res = await apiFetch(`/api/patients?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (err) {
      console.error("Search failed:", err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleClearSearch = () => {
    setPendingSearchQuery("");
    setSearchQuery("");
    setSearchResults(null);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearchSubmit();
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300 border border-green-200 dark:border-green-900/40";
      case "under_treatment":
        return "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40";
      case "follow_up":
        return "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40";
      case "discharged":
        return "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300 border border-red-200 dark:border-red-900/40";
      default:
        return "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40 font-bold";
    }
  };

  return (
    <div className="space-y-6 ">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-theme-on-accent tracking-tight leading-tight">Patient Registries & Records</h2>
        </div>
        {searchResults !== null && (
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 py-1.5 px-3 rounded-lg border border-blue-200 dark:border-blue-900/40 leading-normal">
              Results: {searchResults.length}
            </span>
          </div>
        )}
      </div>

      {/* Lookup controls bar */}
      <div className="minimal-card p-5 rounded-lg bg-white">
        
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-600 dark:text-slate-300" />
          <input
            type="text"
            id="input-search-records"
            value={pendingSearchQuery}
            onChange={(e) => setPendingSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search by patient name, BHT, clinic, auto ID, NIC, TP, or hospital..."
            className="w-full pr-36 pl-11 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:border-blue-600 outline-none focus:ring-1 focus:ring-blue-500 transition-all text-xs"
          />
          {searchResults !== null && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-28 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-blue-700 dark:hover:text-blue-300 py-1 px-2 rounded-lg transition"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={handleSearchSubmit}
            disabled={searching}
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-60"
          >
            {searching ? (
              <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {searching ? "Searching..." : "Search"}
          </button>
        </div>

      </div>

      {/* Patient lookup list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {patients.map((pat) => {
          const patientName = [pat.title, pat.first_name, pat.last_name].filter(Boolean).join(" ") || "Unnamed Patient";
          const oncology = (pat.oncology_types && pat.oncology_types.length > 0 ? pat.oncology_types : [pat.oncology || "Other"]).join(", ");
          const status = pat.status || "active";

          return (
          <div 
            key={pat.id} 
            className="minimal-card rounded-lg hover:border-blue-500 hover:shadow-md p-5 flex flex-col justify-between bg-white"
          >
            <div>
              {/* Header Badge Row */}
              <div className="flex justify-between items-start gap-2 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <span className="text-[11.5px] font-bold text-slate-500 dark:text-slate-400 tracking-wider leading-none">{pat.auto_id || "PT-N/A"}</span>
                    <h3 className="value-display font-bold text-slate-805 dark:text-slate-100 truncate text-sm leading-snug">
                      {patientName}
                    </h3>
                  </div>
                </div>

                <span className={`eyebrow px-2.5 py-0.5 rounded-full border leading-normal ${getStatusBadgeClass(status)}`}>
                  {status.replace("_", " ")}
                </span>
              </div>

              {/* Patient core descriptors */}
              <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-200 border-y border-natural-border/45 dark:border-slate-700/80 py-3 mb-4">
                <div className="flex items-center gap-2 justify-between">
                  <span className="text-slate-655 dark:text-slate-350 font-semibold leading-normal">Class & Type:</span>
                  <span className="value-display font-bold px-2 py-0.5 rounded-lg text-[11.5px] leading-none text-slate-805 dark:text-slate-200">
                    {oncology}
                  </span>
                </div>

                <div className="flex items-center gap-2 justify-between">
                  <span className="text-slate-655 dark:text-slate-350 font-semibold leading-normal">Age / Gender:</span>
                  <span className="value-display font-semibold leading-normal text-slate-805 dark:text-slate-100">
                    {pat.gender || "Male"} • {pat.age || "N/A"} yrs
                  </span>
                </div>

                {pat.overall_stage && (
                  <div className="flex items-center gap-2 justify-between ">
                    <span className="text-slate-655 dark:text-slate-350 font-semibold leading-normal">Tumor Stage:</span>
                    <span className="value-display text-slate-805 dark:text-slate-100 font-bold leading-normal">
                      {pat.overall_stage} {pat.tnm_stage ? `(${pat.tnm_stage})` : ""}
                    </span>
                  </div>
                )}

                {pat.hospital && (
                  <div className="flex items-center gap-1.5 justify-between">
                    <span className="text-slate-655 dark:text-slate-350 font-semibold flex items-center gap-1 leading-normal">
                      <Building className="h-3.5 w-3.5 text-blue-600" />
                      <span>Hospital:</span>
                    </span>
                    <span className="value-display truncate max-w-[150px] text-slate-805 dark:text-slate-100 font-semibold leading-normal" title={pat.hospital}>{pat.hospital}</span>
                  </div>
                )}

                {pat.tp && (
                  <div className="flex items-center gap-1.5 justify-between ">
                    <span className="text-slate-655 dark:text-slate-350 font-semibold flex items-center gap-1 leading-normal">
                      <Phone className="h-3.5 w-3.5 text-green-600" />
                      <span>Phone:</span>
                    </span>
                    <span className="value-display text-slate-805 dark:text-slate-100 font-semibold leading-normal">{pat.tp}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Bottom bar with unique trigger IDs */}
            <div className="flex items-center gap-2.5 pt-1 text-xs">
              <button
                id={`btn-search-view-${pat.id}`}
                onClick={() => onViewPatient(pat)}
                className="btn-clr-view flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11.5px] font-bold transition-colors cursor-pointer select-none"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>View Dossier</span>
              </button>
              
              <button
                id={`btn-search-edit-${pat.id}`}
                onClick={() => onEditPatient(pat)}
                className="btn-clr-edit inline-flex items-center justify-center p-2 rounded-lg transition-colors cursor-pointer"
                title="Edit Records"
              >
                <Edit className="h-4 w-4" />
              </button>

              <button
                id={`btn-search-delete-${pat.id}`}
                onClick={() => onDeletePatient(pat.id, pat)}
                className="btn-clr-delete inline-flex items-center justify-center p-2 rounded-lg transition-colors cursor-pointer"
                title="Delete Record"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

          </div>
        )})}

        {patients.length === 0 && !searching && (
          <div className="col-span-full py-16 text-center minimal-card rounded-lg bg-white">
            <div className="flex justify-center text-natural-border mb-3">
              <Search className="h-12 w-12 text-blue-600" />
            </div>
            {searchQuery ? (
              <>
                <h4 className="font-bold text-slate-700 dark:text-slate-200">No Patient Records Matched</h4>
                <p className="text-xs text-slate-655 dark:text-slate-200 mt-1 max-w-sm mx-auto">
                  Modify the search query and try again.
                </p>
              </>
            ) : (
              <>
                <h4 className="font-bold text-slate-700 dark:text-slate-200">Search Patients</h4>
                <p className="text-xs text-slate-655 dark:text-slate-200 mt-1 max-w-sm mx-auto">
                  Enter BHT number, clinic number, name, or NIC above and click Search.
                </p>
              </>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
