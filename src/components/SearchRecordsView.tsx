/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { 
  Search, 
  ArrowUpDown,
  Eye,
  Edit,
  Trash2,
  Building,
  Phone,
} from "lucide-react";
import { PatientRecord, OncologyCategory } from "../types";
import { apiFetch } from "../lib/api-client";

interface SearchRecordsViewProps {
  onViewPatient: (pat: PatientRecord) => void;
  onEditPatient: (pat: PatientRecord) => void;
  onDeletePatient: (id: string) => void;
}

export default function SearchRecordsView({ 
  onViewPatient, 
  onEditPatient, 
  onDeletePatient,
}: SearchRecordsViewProps) {

  // Sorters and Filters state
  const [pendingSearchQuery, setPendingSearchQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PatientRecord[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedOncology, setSelectedOncology] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [selectedHospital, setSelectedHospital] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"name" | "updatedAt" | "overall_stage" | "oncology">("updatedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Get unique hospitals from search results to populate dynamic hospital selector
  const uniqueHospitals = Array.from(
    new Set((searchResults ?? []).map(p => p.hospital).filter(h => h && h.trim() !== ""))
  );

  // Client-side filter + sort on server search results only
  const sortedPatients = useMemo(() => {
    const source = searchResults ?? [];
    const query = searchQuery.trim().toLowerCase();
    const terms = query.split(/\s+/).filter(Boolean);

    const filtered = source.filter((pat) => {
      // Server already filtered by search terms, so only apply oncology/status/hospital filters
      const patientOncologyTypes = pat.oncology_types && pat.oncology_types.length > 0 ? pat.oncology_types : [pat.oncology || "Other"];
      const matchesOncology = selectedOncology === "All" || patientOncologyTypes.includes(selectedOncology);
      const matchesStatus = selectedStatus === "All" || pat.status === selectedStatus;
      const matchesHospital = selectedHospital === "All" || pat.hospital === selectedHospital;
      return matchesOncology && matchesStatus && matchesHospital;
    });

    return filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "name") {
        const nameA = `${a.first_name || ""} ${a.last_name || ""}`.toLowerCase();
        const nameB = `${b.first_name || ""} ${b.last_name || ""}`.toLowerCase();
        comparison = nameA.localeCompare(nameB);
      } else if (sortBy === "overall_stage") {
        const stageA = a.overall_stage || "";
        const stageB = b.overall_stage || "";
        comparison = stageA.localeCompare(stageB);
      } else if (sortBy === "oncology") {
        const oncA = a.oncology || "";
        const oncB = b.oncology || "";
        comparison = oncA.localeCompare(oncB);
      } else {
        const dateA = new Date(a.updatedAt).getTime();
        const dateB = new Date(b.updatedAt).getTime();
        comparison = dateA - dateB;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [searchResults, searchQuery, selectedOncology, selectedStatus, selectedHospital, sortBy, sortDirection]);

  const handleToggleDirection = () => {
    setSortDirection(prev => prev === "asc" ? "desc" : "asc");
  };

  const handleSearchSubmit = async () => {
    const query = pendingSearchQuery.trim();
    setSearchQuery(query);
    if (!query) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const res = await apiFetch(`/api/patients?search=${encodeURIComponent(query)}&includeDeleted=false&limit=100`);
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
        return "bg-natural-accent/10 text-natural-accent-dark dark:text-natural-hover border border-natural-accent/30 dark:border-natural-accent/20";
      case "under_treatment":
        return "bg-natural-brown/10 text-natural-brown dark:text-natural-gold border border-natural-brown/30";
      case "follow_up":
        return "bg-natural-card dark:bg-slate-900 text-slate-700 dark:text-slate-350 border border-natural-border dark:border-slate-700";
      case "discharged":
        return "bg-natural-brown/15 dark:bg-natural-brown/10 text-natural-brown dark:text-natural-gold border border-natural-brown/30";
      default:
        return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-205 font-bold";
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
            <span className="bg-natural-accent/10 dark:bg-natural-accent/20 text-natural-accent-dark dark:text-natural-hover py-1.5 px-3 rounded-xl border border-natural-accent/30 leading-normal">
              Results: {searchResults.length}
            </span>
          </div>
        )}
      </div>

      {/* Lookup controls bar */}
      <div className="minimal-card p-5 rounded-2xl space-y-4">
        
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
            className="w-full pr-36 pl-11 py-3 bg-slate-50 dark:bg-slate-900 border border-natural-border dark:border-slate-700 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl focus:border-natural-accent outline-none focus:ring-1 focus:ring-natural-accent transition-all text-xs"
          />
          {searchResults !== null && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-28 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 py-1 px-2 rounded-lg transition"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={handleSearchSubmit}
            disabled={searching}
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-2 bg-natural-accent text-theme-on-accent px-3 py-2 rounded-xl text-xs font-semibold hover:bg-natural-accent-dark transition disabled:opacity-60"
          >
            {searching ? (
              <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {searching ? "Searching..." : "Search"}
          </button>
        </div>

        {/* Filters and Sorting controls row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          
          {/* Oncology Filter */}
          <div className="space-y-1">
            <label className="label-form block leading-none">Oncology Class</label>
            <select
              value={selectedOncology}
              onChange={(e) => setSelectedOncology(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 rounded-button cursor-pointer"
            >
              <option value="All">All Tumor Types</option>
              {Object.values(OncologyCategory).map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <label className="label-form block leading-none">Clinical Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 rounded-button cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="active">Active</option>
              <option value="under_treatment">Under Treatment</option>
              <option value="follow_up">Follow Up</option>
              <option value="discharged">Discharged</option>
            </select>
          </div>

          {/* Hospital Filter */}
          <div className="space-y-1">
            <label className="label-form block leading-none">Admitted Hospital</label>
            <select
              value={selectedHospital}
              onChange={(e) => setSelectedHospital(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 rounded-button cursor-pointer"
            >
              <option value="All">All Hospitals</option>
              {uniqueHospitals.map((hosp) => (
                <option key={hosp} value={hosp}>{hosp}</option>
              ))}
            </select>
          </div>

          {/* Sort By Field */}
          <div className="space-y-1">
            <label className="label-form block leading-none">Order Criteria</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 rounded-button cursor-pointer"
            >
              <option value="updatedAt">Last Modified</option>
              <option value="name">Patient Name</option>
              <option value="oncology">Cancer Type</option>
              <option value="overall_stage">Overall Tumor Stage</option>
            </select>
          </div>

          {/* Toggle Sorting Direction */}
          <div className="space-y-1 flex flex-col justify-end">
            <button
              onClick={handleToggleDirection}
              className="w-full p-2.5 flex items-center justify-center gap-2 bg-slate-50 hover:bg-natural-sidebar dark:bg-slate-705 dark:hover:bg-slate-650 text-slate-755 dark:text-slate-350 font-semibold border border-natural-border dark:border-slate-650 rounded-xl transition cursor-pointer select-none"
            >
              <ArrowUpDown className="h-4 w-4 text-natural-accent" />
              <span>{sortDirection === "asc" ? "Ascending" : "Descending"}</span>
            </button>
          </div>

        </div>

      </div>

      {/* Patient lookup list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {sortedPatients.map((pat) => {
          const patientName = [pat.title, pat.first_name, pat.last_name].filter(Boolean).join(" ") || "Unnamed Patient";
          const oncology = (pat.oncology_types && pat.oncology_types.length > 0 ? pat.oncology_types : [pat.oncology || "Other"]).join(", ");
          const status = pat.status || "active";

          return (
          <div 
            key={pat.id} 
            className="minimal-card rounded-2xl hover:border-natural-accent hover:shadow-md p-5 flex flex-col justify-between"
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
                      <Building className="h-3.5 w-3.5 text-natural-brown" />
                      <span>Hospital:</span>
                    </span>
                    <span className="value-display truncate max-w-[150px] text-slate-805 dark:text-slate-100 font-semibold leading-normal" title={pat.hospital}>{pat.hospital}</span>
                  </div>
                )}

                {pat.tp && (
                  <div className="flex items-center gap-1.5 justify-between ">
                    <span className="text-slate-655 dark:text-slate-350 font-semibold flex items-center gap-1 leading-normal">
                      <Phone className="h-3.5 w-3.5 text-natural-accent" />
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
                className="btn-clr-view flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11.5px] font-bold transition-colors cursor-pointer select-none"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>View Dossier</span>
              </button>
              
              <button
                id={`btn-search-edit-${pat.id}`}
                onClick={() => onEditPatient(pat)}
                className="btn-clr-edit inline-flex items-center justify-center p-2 rounded-xl transition-colors cursor-pointer"
                title="Edit Records"
              >
                <Edit className="h-4 w-4" />
              </button>

              <button
                id={`btn-search-delete-${pat.id}`}
                onClick={() => onDeletePatient(pat.id)}
                className="btn-clr-delete inline-flex items-center justify-center p-2 rounded-xl transition-colors cursor-pointer"
                title="Delete Record"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

          </div>
        )})}

        {sortedPatients.length === 0 && !searching && (
          <div className="col-span-full py-16 text-center minimal-card rounded-2xl">
            <div className="flex justify-center text-natural-border mb-3">
              <Search className="h-12 w-12 text-natural-accent" />
            </div>
            {searchQuery ? (
              <>
                <h4 className="font-bold text-slate-700 dark:text-slate-200">No Patient Records Matched</h4>
                <p className="text-xs text-slate-655 dark:text-slate-200 mt-1 max-w-sm mx-auto">
                  Modify search query or filters and try again.
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
