import { TrashMap, type MyLocation, type TrashReport } from "@/components/map/TrashMap";
import ReportDetailPanel from "@/components/map/ReportDetailPanel";
import { useEffect, useState } from "react";
import { watchLocation } from "@/utils/location";

const SAMPLE_REPORTS: TrashReport[] = [
    {
        id: '1', lat: 14.4550, lng: 120.9520, severity: 'HIGH', details: 'Illegal dump site behind store', locationLabel: 'Roxas Blvd, Pasay City',
        imageUrls: [
            'https://images.unsplash.com/photo-1621451537084-482c73073a0f?w=400',
            'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?w=400',
        ],
    },
    { id: '2', lat: 14.4552, lng: 120.9523, severity: 'HIGH', details: 'Heavy pile of garbage bags', locationLabel: 'F.B. Harrison St, Pasay City' },
    { id: '3', lat: 14.4650, lng: 120.9450, severity: 'LOW', details: 'Single plastic cup on curb', locationLabel: 'EDSA cor. Taft Ave, Pasay City' },
];



export default function MapViewPage() {
    const [userLoc, setUserLoc] = useState<MyLocation>({ lat: null, lng: null });
    const [userLocError, setuserLocError] = useState<string | null>(null);
    const [selectedReport, setSelectedReport] = useState<TrashReport | null>(null);

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
      <div className="h-[calc(100dvh-3.5rem)] md:h-dvh">
        <TrashMap
          reports={SAMPLE_REPORTS}
          showLogo={false}
          myLocation={userLoc}
          onMarkerClick={setSelectedReport}
          isDetailPanelOpen={!!selectedReport}
          selectedReportId={selectedReport?.id}
        />

        {selectedReport && (
          <ReportDetailPanel report={selectedReport} onClose={() => setSelectedReport(null)} />
        )}
      </div>
    );
}
