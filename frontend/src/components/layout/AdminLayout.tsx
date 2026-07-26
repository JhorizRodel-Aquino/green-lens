import { Outlet } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";
import { ReportsProvider } from "@/context/ReportsContext";

export default function AdminLayout() {
    return (
        <ReportsProvider>
            <div className="flex flex-col md:flex-row min-h-dvh bg-light">
                <Sidebar />
                <main className="flex-1 min-w-0">
                    <Outlet />
                </main>
            </div>
        </ReportsProvider>
    )
}
