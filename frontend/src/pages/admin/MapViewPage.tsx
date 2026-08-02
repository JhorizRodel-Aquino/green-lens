import { TrashMap, type MyLocation } from "@/components/map/TrashMap";
import ReportDetailPanel from "@/components/map/ReportDetailPanel";
import LguFilter, { useLguFilter } from "@/components/admin/LguFilter";
import { useReports } from "@/context/ReportsContext";
import { useEffect, useState } from "react";
import { watchLocation } from "@/utils/location";

export default function MapViewPage() {
    const { reports } = useReports();
    const unresolvedReports = reports.filter((r) => r.status === 'unresolved');
    const { selectedLgu, setSelectedLgu, lguOptions, filteredReports } = useLguFilter(unresolvedReports);
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
      <div className="h-[calc(100dvh-3.5rem)] md:h-dvh relative">
        {lguOptions.length > 1 && (
          <div className="absolute top-16 right-4 z-[1000]">
            <LguFilter value={selectedLgu} onChange={setSelectedLgu} options={lguOptions} />
          </div>
        )}
        <TrashMap
          reports={filteredReports}
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
