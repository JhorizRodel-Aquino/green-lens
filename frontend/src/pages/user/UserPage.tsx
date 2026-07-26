import { useEffect, useState } from "react";
import { TrashMap, type MyLocation, type TrashReport } from "@/components/map/TrashMap";
import UserLayout from "@/components/layout/UserLayout";
import ReportCamera from "@/components/ReportCamera";
import { Button } from "@/components/ui/Button";
import LocationTracker from "@/components/LocationTracker";
import { watchLocation } from "@/utils/location";


export default function UserPage() {
        // Initial Sample Data
    const initialReports: TrashReport[] = [
        { id: '1', lat: 14.4550, lng: 120.9520, severity: 'HIGH', details: 'Illegal dump site behind store' },
        { id: '2', lat: 14.4552, lng: 120.9523, severity: 'HIGH', details: 'Heavy pile of garbage bags' },
        { id: '3', lat: 14.4650, lng: 120.9450, severity: 'LOW', details: 'Single plastic cup on curb' },
    ];

    

    const [openDrawer, setDrawerModal] = useState(false)
    const [showCamera, setShowCamera] = useState(false);

    const [userLoc, setUserLoc] = useState<MyLocation>({ lat: null, lng: null });
    const [userLocError, setuserLocError] = useState<string | null>(null);
    
    useEffect(() => {
    // Start watching location
    const unwatch = watchLocation(
        (result) => {
        // This runs every time location updates
        setUserLoc({ lat: result.lat, lng: result.lng });
        console.log('📍 Updated:', result.lat, result.lng);
        },
        (err) => {
        setuserLocError(err.message);
        }
    );

    // Stop watching when component unmounts
    return () => unwatch();
    }, []);

    return (
        <UserLayout>
            <TrashMap reports={initialReports} myLocation={userLoc} showLogo={true}/>

            <div
                className={`absolute inset-x-0 bottom-0 h-[85dvh] z-[9999] rounded-t-[30px] bg-light transition-transform duration-300 ease-in-out ${openDrawer ? "translate-y-0" : "translate-y-[calc(100%-60px)]"
                    }`}
            >
                {/* Always visible peek handle section */}
                <div className="flex h-[60px] cursor-pointer flex-col items-center justify-center border-b px-4 bg-light-lighter"
                    onClick={() => setDrawerModal(!openDrawer)}>
                    <div className="h-1.5 w-12 rounded-full bg-gray-300 mb-2" />
                    <span className="text-sm font-medium text-gray-600">
                        {openDrawer ? "Slide down to close" : "Swipe up or tap to expand"}
                    </span>
                </div>

                {/* Rest of the drawer content (visible when expanded) */}
                <div className="">
                    <LocationTracker />
                    {/* Button to open camera */}
                    <Button className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 bg-primary text-white px-6 py-3 rounded-full" onClick={() => setShowCamera(true)}>Report Trash</Button>
                </div>

                <nav className="absolute bottom-0 w-full border-t border-gray-200 bg-light-lighter shadow-lg">
                    <ul className="grid grid-cols-2 h-[76px]">
                        <li className="relative flex flex-col items-center justify-center gap-0.5 text-gray-400 hover:text-primary transition-colors duration-200 active:scale-95 cursor-pointer">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-[11px] font-medium">Create Report</span>
                        </li>
                        <li className="relative flex flex-col items-center justify-center gap-0.5 text-gray-400 hover:text-primary transition-colors duration-200 active:scale-95 cursor-pointer">
                            <div className="relative">
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                <span className="absolute -top-1 -right-1 bg-red-500 text-light-lighter text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">3</span>
                            </div>
                            <span className="text-[11px] font-medium">My Reports</span>
                        </li>
                    </ul>
                </nav>
            </div>
            
            {showCamera && (
                <div className="fixed inset-0 z-[99999] bg-black h-dvh w-full">
                    <ReportCamera onClose={() => setShowCamera(false)} />
                </div>
            )}
        </UserLayout>
    )
}