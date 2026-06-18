/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Home, 
  LayoutDashboard, 
  UserPlus, 
  Search, 
  Settings, 
  LogOut, 
  X,
  Activity,
  Trash2,
  Shield,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { UserAccount } from "../types";

export type MenuType = "Home" | "Dashboard" | "Add Patient" | "Search Records" | "Settings" | "Trash" | "Audit Log";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeMenu: MenuType;
  onChangeMenu: (menu: MenuType) => void;
  currentUser: UserAccount;
  onSignOut: () => void;
}

export default function Sidebar({ collapsed, onToggleCollapse, activeMenu, onChangeMenu, currentUser, onSignOut }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuItems = [
    { name: "Home" as MenuType, icon: Home, color: "#10B981" },
    { name: "Dashboard" as MenuType, icon: LayoutDashboard, color: "#3B82F6" },
    { name: "Add Patient" as MenuType, icon: UserPlus, color: "#8B5CF6" },
    { name: "Search Records" as MenuType, icon: Search, color: "#06B6D4" },
    { name: "Trash" as MenuType, icon: Trash2, color: "#F43F5E" },
    { name: "Audit Log" as MenuType, icon: Shield, color: "#6366F1" },
    { name: "Settings" as MenuType, icon: Settings, color: "#F59E0B" },
  ];


  const handleMenuClick = (menu: MenuType) => {
    onChangeMenu(menu);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile top-bar */}
      <div className="lg:hidden flex items-center gap-2 minimal-header px-4 py-3 sticky top-0 z-30 transition-colors duration-200">
        <button
          id="btn-mobile-menu"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-650 dark:text-slate-300 hover:bg-natural-hover dark:hover:bg-slate-755 hover-scale"
          aria-label="Toggle sidebar"
          aria-expanded={mobileOpen}
        >
          <span className="hamburger-btn" data-open={mobileOpen ? "true" : "false"}>
            <span /><span /><span />
          </span>
        </button>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: "#4F46E5" }}>
          <Activity className="h-5 w-5 animate-pulse" />
        </div>
        <span className="font-bold tracking-tight leading-none" style={{ color: "#4F46E5" }}>AI DMS</span>
      </div>

      {/* Sidebar background wrapper */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 minimal-sidebar flex flex-col justify-between lg:translate-x-0 lg:fixed lg:h-screen drawer-slide-in transition-all duration-200
        ${collapsed ? "w-[72px] p-3" : "w-[260px] p-5"}
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
      `} style={mobileOpen ? undefined : { animation: "none" }}>
        {/* Header Branding */}
        <div>
          <div className="flex items-center justify-between lg:justify-start gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: "#4F46E5" }}>
                <Activity className="h-6 w-6 animate-pulse" />
              </div>
              <div className={collapsed ? "hidden" : ""}>
                <h1 className="font-bold text-base tracking-tight leading-none" style={{ color: "#4F46E5" }}>AI DMS</h1>
              </div>
            </div>
            <button className="lg:hidden text-natural-accent hover:text-natural-accent-dark dark:text-theme-on-accent" onClick={() => setMobileOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className={`mb-6 rounded-2xl border border-theme-highlight/10 bg-theme-surface dark:bg-slate-950 ${collapsed ? "p-2" : "p-4"} text-sm text-slate-700 dark:text-slate-200`}>
            <p className={`font-semibold text-slate-900 dark:text-theme-on-accent ${collapsed ? "hidden" : ""}`}>Signed in as</p>
            <p className={`mt-1 truncate font-bold ${collapsed ? "text-[11.5px] text-center" : ""}`}>{collapsed ? currentUser.name.charAt(0).toUpperCase() : currentUser.name}</p>
            <p className={`text-[11.5px] text-slate-500 dark:text-slate-400 mt-1 ${collapsed ? "hidden" : ""}`}>{currentUser.role === 'admin' ? 'Administrator' : 'Clinician'}</p>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5 stagger">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeMenu === item.name;
              return (
                <button
                  id={`nav-item-${item.name.toLowerCase().replace(" ", "-")}`}
                  key={item.name}
                  onClick={() => handleMenuClick(item.name)}
                  className={`
                    w-full flex items-center ${collapsed ? "justify-center px-0" : "gap-3 px-4"} py-2.5 rounded-xl text-sm font-semibold text-left cursor-pointer
                    hover-lift ripple-on-click
                    ${isActive
                      ? "text-white font-semibold shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }
                  `}
                  style={isActive ? { backgroundColor: item.color } : undefined}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = item.color + "18"; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <Icon className={`h-5 w-5 ${isActive ? "icon-spin-hover" : ""}`} style={{ color: isActive ? "#fff" : item.color }} />
                  <span className={`tab-underline ${collapsed ? "hidden" : ""}`}>{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="space-y-3 pt-4 border-t border-natural-border">
          <button
            onClick={onToggleCollapse}
            className={`w-full flex items-center justify-center ${collapsed ? "px-1 py-2" : "px-3.5 py-2"} rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 bg-theme-surface/60 hover:bg-natural-hover dark:hover:bg-slate-800 border border-natural-border cursor-pointer hover-lift ripple-on-click`}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            <span className={collapsed ? "hidden" : "ml-2"}>Collapse</span>
          </button>
          <button
            id="btn-signout"
            onClick={onSignOut}
            className={`w-full flex items-center ${collapsed ? "justify-center px-1 py-2.5" : "justify-between px-3.5 py-2.5"} rounded-lg text-xs font-semibold text-rose-700 dark:text-rose-405 bg-theme-surface/60 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-955/45 border border-natural-border cursor-pointer hover-lift ripple-on-click`}
            title={collapsed ? "Sign out" : undefined}
          >
            <span className={`flex items-center ${collapsed ? "" : "gap-2"}`}>
              <LogOut className="h-4 w-4 icon-spin-hover" />
              <span className={collapsed ? "hidden" : ""}>Sign out Session</span>
            </span>
            <span className={`text-[11.5px] opacity-60 ${collapsed ? "hidden" : ""}`}>ESC</span>
          </button>
        </div>
      </aside>

      {/* Mobile backdrop slide-out catcher */}
      {mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)} 
          className="fixed inset-0 bg-slate-950/60 lg:hidden z-40 transition-opacity"
        />
      )}
    </>
  );
}
