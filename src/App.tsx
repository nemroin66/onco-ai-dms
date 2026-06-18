/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { apiFetch } from "./lib/api-client";
import LoginScreen from "./components/LoginScreen";
import Sidebar, { MenuType } from "./components/Sidebar";
import { initAuth, logout } from "./lib/auth";
import HomeView from "./components/HomeView";
import AddPatientView from "./components/AddPatientView";
import SearchRecordsView from "./components/SearchRecordsView";
import PatientView from "./components/PatientView";
import SettingsView from "./components/SettingsView";
import TrashView from "./components/TrashView";
import { AppDialogProvider, confirmDialog, notify } from "./components/AppDialog";
import PageTransition from "./components/PageTransition";
import type { DiskFile, PatientRecord, UserAccount } from "./types";

const DashboardView = React.lazy(() => import("./components/DashboardView"));

function AppContent() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsub = initAuth(async (firebaseUser) => {
      try {
        const profileRes = await apiFetch("/api/users");
        const profile = profileRes.ok ? await profileRes.json() : {};
        setCurrentUser({
          uid: firebaseUser.uid,
          name: profile?.name || firebaseUser.displayName || firebaseUser.email || "User",
          email: firebaseUser.email || profile?.email || "",
          role: profile?.role === "admin" ? "admin" : "user",
          avatarColor: profile?.role === "admin" ? "bg-natural-accent" : "bg-natural-brown",
        });
      } finally {
        setAuthReady(true);
      }
    }, () => {
      setCurrentUser(null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const [activeMenu, setActiveMenu] = useState<MenuType>("Home");
  const [allPatients, setAllPatients] = useState<PatientRecord[]>([]);
  const [deletedPatients, setDeletedPatients] = useState<PatientRecord[]>([]);
  const [allFiles, setAllFiles] = useState<DiskFile[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [patientUnderEdit, setPatientUnderEdit] = useState<PatientRecord | null>(null);
  const [formDirty, setFormDirty] = useState(false);
  const [isLoadingMain, setIsLoadingMain] = useState(false);
  const [recentPatientsLoaded, setRecentPatientsLoaded] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [filesLoaded, setFilesLoaded] = useState(false);
  const [trashLoaded, setTrashLoaded] = useState(false);
  const [liveCounts, setLiveCounts] = useState<{ active: number; deleted: number; total: number } | null>(null);
  const fetchReqIdRef = useRef(0);
  const fileFetchReqIdRef = useRef(0);
  const trashFetchReqIdRef = useRef(0);


  // Force Matte Light as default — ignores browser/OS/prefers-color-scheme.
  useEffect(() => {
    const mode = localStorage.getItem("theme") || "light";
    document.documentElement.classList.toggle("dark", mode === "dark");
    document.documentElement.dataset.themeMode = mode;
  }, []);

  const handleRefreshCounts = useCallback(async () => {
    try {
      const res = await apiFetch("/api/patients/count");
      if (res.ok) setLiveCounts(await res.json());
    } catch (err) {
      console.error("Failed to refresh patient counts:", err);
    }
  }, []);

  const fetchClinicalDatabase = async () => {
    const reqId = ++fetchReqIdRef.current;
    setIsLoadingMain(true);
    try {
      const patRes = await apiFetch("/api/patients?includeDeleted=false&limit=50");
      if (reqId !== fetchReqIdRef.current) return; // stale

      if (patRes.ok) {
        const patientsData = await patRes.json();
        if (reqId !== fetchReqIdRef.current) return;
        setAllPatients(patientsData);
        setRecentPatientsLoaded(true);
      }
    } catch (err) {
      console.error("Clinical Server Fetch failed:", err);
    } finally {
      if (reqId === fetchReqIdRef.current) {
        setIsLoadingMain(false);
      }
    }
  };

  const fetchTrashPatients = useCallback(async () => {
    const reqId = ++trashFetchReqIdRef.current;
    try {
      const patRes = await apiFetch("/api/patients/trash");
      if (reqId !== trashFetchReqIdRef.current) return;
      if (patRes.ok) {
        setDeletedPatients(await patRes.json());
        setTrashLoaded(true);
      }
    } catch (err) {
      console.error("Trash fetch failed:", err);
    }
  }, []);

  const fetchClinicalFiles = useCallback(async () => {
    const reqId = ++fileFetchReqIdRef.current;
    setIsLoadingFiles(true);
    try {
      const fileRes = await apiFetch("/api/files");
      if (reqId !== fileFetchReqIdRef.current) return;
      if (fileRes.ok) {
        setAllFiles(await fileRes.json());
        setFilesLoaded(true);
      }
    } catch (err) {
      console.error("Clinical file metadata fetch failed:", err);
    } finally {
      if (reqId === fileFetchReqIdRef.current) {
        setIsLoadingFiles(false);
      }
    }
  }, []);

  useEffect(() => {
    if (currentUser && activeMenu === "Add Patient" && !filesLoaded && !isLoadingFiles) {
      void fetchClinicalFiles();
    }
  }, [activeMenu, currentUser, fetchClinicalFiles, filesLoaded, isLoadingFiles]);

  useEffect(() => {
    if (currentUser && activeMenu === "Trash" && !trashLoaded) {
      void fetchTrashPatients();
    }
  }, [activeMenu, currentUser, fetchTrashPatients, trashLoaded]);

  const handleLoginSuccess = useCallback((user: UserAccount) => {
    setCurrentUser(user);
  }, []);

  const handleSignOut = useCallback(async () => {
    await logout();
    setCurrentUser(null);
    setActiveMenu("Home");
  }, []);

  // Create or Update Patient Record in database
  const handleSavePatient = async (record: PatientRecord): Promise<PatientRecord> => {
    const isUpdate = !!record.id;
    const url = isUpdate ? `/api/patients/${record.id}` : "/api/patients";
    const method = isUpdate ? "PUT" : "POST";

    const response = await apiFetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record)
    });

    if (!response.ok) {
      throw new Error("Failed to save patient entry");
    }

    const savedRecord = await response.json();
    setAllPatients((current) => [savedRecord, ...current.filter((patient) => patient.id !== savedRecord.id)].slice(0, 50));
    setRecentPatientsLoaded(true);

    // Reset editing point
    setPatientUnderEdit(null);
    return savedRecord;
  };

  // Delete Patient dossiers atomically from DB and Google Drive Virtual Folder
  const handleDeletePatient = async (id: string, patient?: PatientRecord) => {
    const pat = patient || allPatients.find(p => p.id === id) || (selectedPatient?.id === id ? selectedPatient : null);
    if (!pat) return;

    const confirmed = await confirmDialog(
      `You are about to move patient '${pat.title ? `${pat.title} ` : ""}${pat.first_name} ${pat.last_name}' to the trash. You can restore it later or permanently purge it from the trash bin.\n\nDo you want to proceed?`,
      "Regulatory Warning",
      "danger",
      "Move to Trash"
    );

    if (confirmed) {
      try {
        const response = await apiFetch(`/api/patients/${id}`, {
          method: "DELETE"
        });

        if (response.ok) {
          setSelectedPatient(null);
          setAllPatients((current) => current.filter((patient) => patient.id !== id));
          setDeletedPatients((current) => [{ ...pat, isDeleted: true, updatedAt: new Date().toISOString() }, ...current.filter((patient) => patient.id !== id)]);
          setTrashLoaded(true);
          await notify("Patient moved to trash.", "Record Moved", "success");
        } else {
          await notify("Database permission limit. Only authorized clinicians can delete histories.", "Delete Failed", "danger");
        }
      } catch (err) {
        await notify("Operation failed due to clinical server timeout.", "Delete Failed", "danger");
      }
    }
  };

  // Upload clinical reports to Google Drive specific patient subdirectory
  const handleUploadFile = async (payload: { name: string; mimeType: string; size: number; patientId: string; contentBase64: string }) => {
    const response = await apiFetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error("Failed to save virtual drive file metadata");
    }

    const uploadedFile = await response.json();
    setAllFiles((current) => [uploadedFile, ...current.filter((file) => file.id !== uploadedFile.id)]);
    setFilesLoaded(true);
    return uploadedFile;
  };

  const handleViewPatient = (patient: PatientRecord) => {
    setSelectedPatient(patient);
  };

  const handleEditPatient = (patient: PatientRecord) => {
    setSelectedPatient(null);
    setPatientUnderEdit(patient);
    setActiveMenu("Add Patient");
  };

  // Deep Wipe dataset
  const handleWipeDatabase = async () => {
    const response = await apiFetch("/api/wipe", {
      method: "POST"
    });
    if (response.ok) {
      setAllPatients([]);
      setDeletedPatients([]);
      setAllFiles([]);
      setRecentPatientsLoaded(false);
      setFilesLoaded(false);
      setTrashLoaded(false);
    } else {
      throw new Error("Failed to purge db");
    }
  };

  const handleNavigateHome = useCallback(() => {
    setFormDirty(false);
    setPatientUnderEdit(null);
    setActiveMenu("Home");
  }, []);

  const handleUpdateUser = useCallback((updates: { name?: string; role?: "admin" | "user" }) => {
    if (updates.name) {
      setCurrentUser((prev) => prev ? { ...prev, name: updates.name! } : prev);
    }
  }, []);

  const handleChangeMenu = useCallback(async (menu: MenuType) => {
    if (formDirty) {
      const leave = await confirmDialog("You have unsaved changes. Are you sure you want to leave without saving?", "Unsaved Changes", "warning", "Leave", "Stay");
      if (!leave) return;
    }
    setSelectedPatient(null);
    setPatientUnderEdit(null);
    setFormDirty(false);
    setActiveMenu(menu);
  }, [formDirty]);

  // Memoize derived props to avoid unnecessary child re-renders
  const settingsUserProp = useMemo(() => currentUser ? {
    uid: currentUser.uid,
    name: currentUser.name,
    role: currentUser.role,
    email: currentUser.email,
  } : null, [currentUser?.uid, currentUser?.name, currentUser?.role, currentUser?.email]);

  // Restore a deleted patient
  const handleRestorePatient = async (id: string) => {
    try {
      const response = await apiFetch(`/api/patients/${id}/restore`, {
        method: "POST"
      });
      if (response.ok) {
        await notify("Patient record successfully restored to active registry.", "Restore Success", "success");
        const restored = await response.json().catch(() => null);
        setDeletedPatients((current) => current.filter((patient) => patient.id !== id));
        if (restored) {
          setAllPatients((current) => [restored, ...current.filter((patient) => patient.id !== restored.id)].slice(0, 50));
          setRecentPatientsLoaded(true);
        }
      } else {
        throw new Error("Failed to restore patient.");
      }
    } catch (err) {
      await notify("Operation failed. Could not restore patient.", "Restore Failed", "danger");
    }
  };

  // Empty the trash bin
  const handleClearTrash = async () => {
    const confirmed = await confirmDialog(
      "Are you sure you want to PERMANENTLY wipe all deleted records? This action cannot be undone and will purge all associated files from the secure storage.",
      "Regulatory Warning",
      "danger",
      "Empty Trash"
    );

    if (confirmed) {
      try {
        const response = await apiFetch("/api/patients/trash/clear", {
          method: "POST"
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.message || "Unknown error occurred while clearing trash.";
          console.error("Trash clear failed with status:", response.status, "Error:", errorMessage);
          throw new Error(errorMessage);
        }
        
        await notify("Trash emptied. All deleted records have been permanently purged.", "Purge Success", "success");
        setDeletedPatients([]);
        setTrashLoaded(true);
      } catch (err) {
        console.error("Trash clear error:", err);
        let errorMessage = "Operation failed. Could not clear trash.";
        if (err instanceof Error) {
          errorMessage = err.message;
        }
        await notify(errorMessage, "Purge Failed", "danger");
      }
    }
  };

  // Permanently delete a single trashed patient record and all related assets
  const handlePermanentlyDeletePatient = async (id: string) => {
    const confirmed = await confirmDialog(
      "This action will permanently remove the selected trashed patient and all associated Drive files and folders. This cannot be undone.",
      "Final Purge",
      "danger",
      "Delete Permanently"
    );

    if (!confirmed) return;

    try {
      const response = await apiFetch(`/api/patients/${id}/permanent`, {
        method: "DELETE"
      });
      if (response.ok) {
        await notify("Deleted record purged permanently.", "Purge Complete", "success");
        setDeletedPatients((current) => current.filter((patient) => patient.id !== id));
        setTrashLoaded(true);
      } else {
        throw new Error("Failed to permanently delete record.");
      }
    } catch (err) {
      await notify("Operation failed. Could not permanently delete record.", "Purge Failed", "danger");
    }
  };

  if (!authReady) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // Active Menu selector routing
  const renderActiveView = () => {
    if (selectedPatient) {
      return (
        <PatientView
          patient={selectedPatient}
          onEdit={handleEditPatient}
          onDelete={handleDeletePatient}
          onClose={() => setSelectedPatient(null)}
        />
      );
    }

    const routeKey = `${activeMenu}-${patientUnderEdit?.id ?? "new"}-${selectedPatient?.id ?? "none"}`;

    switch (activeMenu) {
      case "Home":
        return (
          <PageTransition routeKey={routeKey} variant="fade">
            <HomeView
              currentUser={currentUser}
              allPatients={allPatients}
              onNavigateMenu={setActiveMenu}
              onViewPatient={handleViewPatient}
              onEditPatient={handleEditPatient}
              onDeletePatient={handleDeletePatient}
              activeCount={liveCounts?.active}
              deletedCount={liveCounts?.deleted}
              onRefreshCounts={handleRefreshCounts}
              onLoadRecentRecords={fetchClinicalDatabase}
              recentRecordsLoading={isLoadingMain}
              recentRecordsLoaded={recentPatientsLoaded}
            />
          </PageTransition>
        );
      case "Dashboard":
        return (
          <PageTransition routeKey={routeKey} variant="scale">
            <React.Suspense fallback={<div className="minimal-card rounded-2xl p-8 text-center text-xs font-semibold text-slate-500">Loading analytics studio...</div>}>
              <DashboardView allPatients={allPatients} currentUser={currentUser} />
            </React.Suspense>
          </PageTransition>
        );
      case "Add Patient":
        return (
          <PageTransition routeKey={routeKey} variant="slide-up">
              <AddPatientView
               key={patientUnderEdit ? patientUnderEdit.id : "new_patient"}
               initialPatientData={patientUnderEdit}
               onSavePatient={handleSavePatient}
               onNavigateHome={handleNavigateHome}
               allExistingFiles={allFiles}
               onUploadFile={handleUploadFile}
               totalPatientsCount={allPatients.length}
               onDirtyChange={setFormDirty}
             />

          </PageTransition>
        );
      case "Search Records":
        return (
          <PageTransition routeKey={routeKey} variant="slide-left">
            <SearchRecordsView
              onViewPatient={handleViewPatient}
              onEditPatient={handleEditPatient}
              onDeletePatient={handleDeletePatient}
            />
          </PageTransition>
        );
      case "Trash":
        return (
          <PageTransition routeKey={routeKey} variant="fade">
            <TrashView
              allPatients={deletedPatients}
              onNavigateMenu={setActiveMenu}
              onRestorePatient={handleRestorePatient}
              onClearTrash={handleClearTrash}
              onPermanentlyDeletePatient={handlePermanentlyDeletePatient}
              onViewPatient={handleViewPatient}
            />
          </PageTransition>
        );
      case "Settings":
        return (
          <PageTransition routeKey={routeKey} variant="fade">
            <SettingsView
              currentUser={settingsUserProp}
              onWipeDatabase={handleWipeDatabase}
              onUpdateUser={handleUpdateUser}
            />
          </PageTransition>
        );
      default:
        return <div className="text-center text-sm py-12 fade-in">Tab under development.</div>;
    }
  };

  return (
    <div className="min-h-screen max-w-full overflow-x-hidden bg-natural-bg text-natural-accent-dark transition-colors duration-200 flex flex-col antialiased relative">
      {/* Sidebar Navigation */}
      <Sidebar
        activeMenu={activeMenu}
        onChangeMenu={handleChangeMenu}
        currentUser={currentUser}
        onSignOut={handleSignOut}
      />

      {/* Main clinical viewport box */}
      <main className="flex-1 overflow-y-auto px-4 py-6 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {renderActiveView()}
        </div>
      </main>

    </div>
  );
}

export default function App() {
  return (
    <AppDialogProvider>
      <AppContent />
    </AppDialogProvider>
  );
}
