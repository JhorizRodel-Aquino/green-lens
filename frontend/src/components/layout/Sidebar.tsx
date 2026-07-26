import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
    LayoutDashboard,
    Map,
    FileText,
    BarChart3,
    Users,
    Settings,
    LogOut,
    Menu,
    X,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { cn } from "@/utils/cn";

const NAV_ITEMS = [
    { label: "Dashboard", to: "/admin", icon: LayoutDashboard, end: true },
    { label: "Map View", to: "/admin/map", icon: Map },
    { label: "Reports", to: "/admin/reports", icon: FileText },
    { label: "Analytics", to: "/admin/analytics", icon: BarChart3 },
    { label: "Users", to: "/admin/users", icon: Users },
    { label: "Settings", to: "/admin/settings", icon: Settings },
];

const COLLAPSE_KEY = "admin-sidebar-collapsed";

function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
    return (
        <>
            <div className={cn("flex items-center h-16 px-4 border-b border-light-dark", collapsed && "justify-center px-0")}>
                <span className="font-bold text-lg text-dark whitespace-nowrap overflow-hidden">
                    {collapsed ? (
                        <span className="text-primary">GL</span>
                    ) : (
                        <>
                            Green<span className="text-primary">Lens</span>
                        </>
                    )}
                </span>
            </div>

            <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
                {NAV_ITEMS.map(({ label, to, icon: Icon, end }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={end}
                        onClick={onNavigate}
                        title={collapsed ? label : undefined}
                        className={({ isActive }) =>
                            cn(
                                "flex items-center gap-3 rounded-lg px-3 min-h-11 text-sm font-medium transition-colors relative",
                                collapsed && "justify-center px-0",
                                isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-dark-light hover:bg-light hover:text-dark"
                            )
                        }
                    >
                        {({ isActive }) => (
                            <>
                                {isActive && (
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-full bg-primary" />
                                )}
                                <Icon size={20} className="shrink-0" />
                                {!collapsed && <span className="truncate">{label}</span>}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            <div className={cn("border-t border-light-dark p-3 flex items-center gap-3", collapsed && "justify-center px-0")}>
                <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
                    A
                </div>
                {!collapsed && (
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-dark truncate">Admin</p>
                    </div>
                )}
                <button
                    type="button"
                    title="Log out"
                    className="shrink-0 text-dark-light hover:text-red-500 transition-colors"
                >
                    <LogOut size={18} />
                </button>
            </div>
        </>
    );
}

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(
        () => localStorage.getItem(COLLAPSE_KEY) === "true"
    );
    const [mobileOpen, setMobileOpen] = useState(false);

    const toggleCollapsed = () => {
        setCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem(COLLAPSE_KEY, String(next));
            return next;
        });
    };

    return (
        <>
            {/* Mobile top bar */}
            <div className="md:hidden flex items-center h-14 px-4 border-b border-light-dark bg-white">
                <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu">
                    <Menu size={24} className="text-dark" />
                </button>
                <span className="ml-3 font-bold text-dark">
                    Green<span className="text-primary">Lens</span>
                </span>
            </div>

            {/* Desktop sidebar */}
            <aside
                className={cn(
                    "hidden md:flex flex-col bg-white border-r border-light-dark h-dvh sticky top-0 transition-all duration-200",
                    collapsed ? "w-16" : "w-64"
                )}
            >
                <SidebarContent collapsed={collapsed} />
                <button
                    type="button"
                    onClick={toggleCollapsed}
                    title={collapsed ? "Expand" : "Collapse"}
                    className="absolute top-4 -right-3 h-6 w-6 rounded-full border border-light-dark bg-white flex items-center justify-center text-dark-light hover:text-primary shadow-sm"
                >
                    {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
            </aside>

            {/* Mobile drawer */}
            {mobileOpen && (
                <div className="md:hidden fixed inset-0 z-50 flex">
                    <div
                        className="fixed inset-0 bg-black/40"
                        onClick={() => setMobileOpen(false)}
                    />
                    <aside className="relative flex flex-col w-64 bg-white h-dvh shadow-xl">
                        <button
                            type="button"
                            onClick={() => setMobileOpen(false)}
                            aria-label="Close menu"
                            className="absolute top-4 right-4 text-dark-light"
                        >
                            <X size={22} />
                        </button>
                        <SidebarContent collapsed={false} onNavigate={() => setMobileOpen(false)} />
                    </aside>
                </div>
            )}
        </>
    );
}
