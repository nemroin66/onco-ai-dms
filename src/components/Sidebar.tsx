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
} from "lucide-react";
import { UserAccount } from "../types";

export type MenuType = "Home" | "Dashboard" | "Add Patient" | "Search Records" | "Settings" | "Trash" | "Audit Log";

interface SidebarProps {
  activeMenu: MenuType;
  onChangeMenu: (menu: MenuType) => void;
  currentUser: UserAccount;
  onSignOut: () => void;
}

export default function Sidebar({ activeMenu, onChangeMenu, currentUser, onSignOut }: SidebarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

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
    setMenuOpen(false);
  };

  return (
    <>
      {/* Top bar — visible on all screen sizes */}
      <div className="flex items-center gap-2 minimal-header px-4 py-3 sticky top-0 z-30 transition-colors duration-200">
        <button
          id="btn-mobile-menu"
          onClick={() => setMenuOpen(!menuOpen)}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-650 dark:text-slate-300 hover:bg-natural-hover dark:hover:bg-slate-755 hover-scale"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <span className="hamburger-btn" data-open={menuOpen ? "true" : "false"}>
            <span /><span /><span />
          </span>
        </button>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: "#4F46E5" }}>
          <Activity className="h-5 w-5 animate-pulse" />
        </div>
        <span className="font-bold tracking-tight leading-none" style={{ color: "#4F46E5" }}>AI DMS</span>
      </div>

      {/* Sidebar drawer overlay */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 minimal-sidebar flex flex-col justify-between w-[260px] p-5 drawer-slide-in transition-all duration-200
        ${menuOpen ? "translate-x-0" : "-translate-x-full"}
      `} style={menuOpen ? undefined : { animation: "none" }}>
        {/* Header Branding */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: "#4F46E5" }}>
                <Activity className="h-6 w-6 animate-pulse" />
              </div>
              <div>
                <h1 className="font-bold text-base tracking-tight leading-none" style={{ color: "#4F46E5" }}>AI DMS</h1>
              </div>
            </div>
            <button className="text-natural-accent hover:text-natural-accent-dark dark:text-theme-on-accent" onClick={() => setMenuOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5 mt-4 stagger">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeMenu === item.name;
              return (
                <button
                  id={`nav-item-${item.name.toLowerCase().replace(" ", "-")}`}
                  key={item.name}
                  onClick={() => handleMenuClick(item.name)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-left cursor-pointer
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
                  <span className="tab-underline">{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="space-y-3 pt-4 border-t border-natural-border">
          <button
            id="btn-signout"
            onClick={onSignOut}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold text-rose-700 dark:text-rose-405 bg-theme-surface/60 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-955/45 border border-natural-border cursor-pointer hover-lift ripple-on-click"
          >
            <span className="flex items-center gap-2">
              <LogOut className="h-4 w-4 icon-spin-hover" />
              <span>Sign out Session</span>
            </span>
            <span className="text-[11.5px] opacity-60">ESC</span>
          </button>
        </div>
      </aside>

      {/* Backdrop */}
      {menuOpen && (
        <div 
          onClick={() => setMenuOpen(false)} 
          className="fixed inset-0 bg-slate-950/60 z-40 transition-opacity"
        />
      )}
    </>
  );
}
