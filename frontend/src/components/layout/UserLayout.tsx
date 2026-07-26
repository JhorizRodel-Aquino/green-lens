import { useState } from "react";
import { TrashMap, type TrashReport } from "../map/TrashMap";

export default function UserLayout() {
    // Initial Sample Data
    const initialReports: TrashReport[] = [
    { id: '1', lat: 14.4550, lng: 120.9520, severity: 'HIGH', details: 'Illegal dump site behind store' },
    { id: '2', lat: 14.4552, lng: 120.9523, severity: 'HIGH', details: 'Heavy pile of garbage bags' },
    { id: '3', lat: 14.4650, lng: 120.9450, severity: 'LOW', details: 'Single plastic cup on curb' },
    ];

    const [openDrawer, setDrawerModal] = useState(true) 


    return (
        <main className="relative h-dvh w-full overflow-hidden">
            <TrashMap reports={initialReports} />
            
            <div
            className={`absolute inset-x-0 bottom-0 h-[85dvh] z-[9999] rounded-t-[30px] bg-white transition-transform duration-300 ease-in-out ${
                openDrawer ? "translate-y-0" : "translate-y-[calc(100%-60px)]"
            }`}
            >
            {/* Always visible peek handle section */}
            <div className="flex h-[60px] cursor-pointer flex-col items-center justify-center border-b px-4"
            onClick={() => setDrawerModal(!openDrawer)}>
                <div className="h-1.5 w-12 rounded-full bg-gray-300 mb-2" />
                <span className="text-sm font-medium text-gray-600">
                {openDrawer ? "Slide down to close" : "Swipe up or tap to expand"}
                </span>
            </div>

            {/* Rest of the drawer content (visible when expanded) */}
            <div className="">
                {/* Map stats, report list, etc. */}
            </div>
            </div>
        </main>
    )
}