import { Outlet } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";

export default function AdminLayout() {
    return (
        <div className="flex flex-col md:flex-row min-h-dvh bg-light">
            <Sidebar />
            <main className="flex-1 min-w-0">
                <Outlet />
            </main>
        </div>
    )
}
