"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Fuel,
  LayoutDashboard,
  Users,
  ClipboardList,
  Star,
  LogOut,
  ChevronRight,
  Clock,
  Shield,
  UserCog,
  BarChart2,
  Menu,
  X,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  role: string;
  userName: string;
  userEmail: string;
}

const adminNav: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: "Employees", href: "/admin/employees", icon: <Users className="w-5 h-5" /> },
  { label: "Work Schedule", href: "/admin/schedule", icon: <CalendarDays className="w-5 h-5" /> },
  { label: "Task Templates", href: "/admin/tasks", icon: <ClipboardList className="w-5 h-5" /> },
  { label: "Shift Reports", href: "/admin/shifts", icon: <BarChart2 className="w-5 h-5" /> },
  { label: "Reviews", href: "/admin/reviews", icon: <Star className="w-5 h-5" /> },
  { label: "My Profile", href: "/admin/profile", icon: <UserCog className="w-5 h-5" /> },
];

const coAdminNav: NavItem[] = [
  { label: "My Dashboard", href: "/employee", icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: "My Schedule", href: "/employee/schedule", icon: <CalendarDays className="w-5 h-5" /> },
  { label: "Task Reviews", href: "/coadmin/reviews", icon: <Star className="w-5 h-5" /> },
  { label: "My Profile", href: "/coadmin/profile", icon: <UserCog className="w-5 h-5" /> },
];

const employeeNav: NavItem[] = [
  { label: "My Dashboard", href: "/employee", icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: "My Schedule", href: "/employee/schedule", icon: <CalendarDays className="w-5 h-5" /> },
];

function getRoleNav(role: string): NavItem[] {
  if (role === "ADMIN") return adminNav;
  if (role === "CO_ADMIN") return coAdminNav;
  return employeeNav;
}

function getRoleLabel(role: string) {
  if (role === "ADMIN") return { label: "Manager", color: "text-purple-400" };
  if (role === "CO_ADMIN") return { label: "Co-Admin", color: "text-yellow-400" };
  return { label: "Employee", color: "text-blue-400" };
}

export function Sidebar({ role, userName, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const nav = getRoleNav(role);
  const roleInfo = getRoleLabel(role);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <aside className="h-full flex flex-col bg-slate-900">
      {/* Logo */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Fuel className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-sm leading-tight">C Checkers</h1>
            <p className="text-slate-400 text-xs">Productivity Tracker</p>
          </div>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden text-slate-400 hover:text-white p-1"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Role badge */}
      <div className="px-4 pt-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800">
          {role === "ADMIN" ? (
            <Shield className="w-4 h-4 text-slate-400" />
          ) : role === "CO_ADMIN" ? (
            <Star className="w-4 h-4 text-slate-400" />
          ) : (
            <Clock className="w-4 h-4 text-slate-400" />
          )}
          <span className={cn("text-xs font-semibold uppercase tracking-wide", roleInfo.color)}>
            {roleInfo.label}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {nav.map((item) => {
          const exactMatch = pathname === item.href;
          const isActive =
            exactMatch ||
            (item.href.split("/").length > 2 &&
              pathname.startsWith(item.href) &&
              !pathname.includes("profile") &&
              !item.href.includes("profile"));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                exactMatch
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              {item.icon}
              <span>{item.label}</span>
              {exactMatch && <ChevronRight className="w-4 h-4 ml-auto" />}
            </Link>
          );
        })}
      </nav>

      {/* User info + signout */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-semibold">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{userName}</p>
            <p className="text-slate-500 text-xs truncate">{userEmail}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block fixed left-0 top-0 h-full w-64 z-30">
        {sidebarContent}
      </div>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900 border-b border-slate-800 z-30 flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-slate-400 hover:text-white p-1"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Fuel className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-sm">C Checkers</span>
        </div>
        <div className="ml-auto">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
            <span className="text-white text-xs font-semibold">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={cn(
          "md:hidden fixed top-0 left-0 h-full w-72 z-50 transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </div>
    </>
  );
}
