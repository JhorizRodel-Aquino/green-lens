import { Outlet } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";

export default function AdminLayout() {
    return (
        <div className="flex min-h-dvh bg-light">
            <Sidebar />
            <main className="flex-1 min-w-0 p-4 md:p-6">
                <Outlet />
            </main>
        </div>
    )
}
