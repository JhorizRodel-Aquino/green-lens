import { TrashMap, type MyLocation } from "@/components/map/TrashMap";
import ReportDetailPanel from "@/components/map/ReportDetailPanel";
import { useReports } from "@/context/ReportsContext";
import { useEffect, useState } from "react";
import { watchLocation } from "@/utils/location";

export default function MapViewPage() {
    const { reports } = useReports();
    const [userLoc, setUserLoc] = useState<MyLocation>({ lat: null, lng: null });
    const [userLocError, setuserLocError] = useState<string | null>(null);
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

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
          reports={reports}
          showLogo={false}
          myLocation={userLoc}
          onMarkerClick={(report) => setSelectedReportId(report.id)}
          isDetailPanelOpen={!!selectedReportId}
          selectedReportId={selectedReportId ?? undefined}
        />

        {selectedReportId && (
          <ReportDetailPanel reportId={selectedReportId} onClose={() => setSelectedReportId(null)} />
        )}
      </div>
    );
}
