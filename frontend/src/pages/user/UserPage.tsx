import { useEffect, useState } from "react";
import { TrashMap, type MyLocation, type TrashReport } from "@/components/map/TrashMap";
import UserLayout from "@/components/layout/UserLayout";
import ReportCamera from "@/components/ReportCamera";
import { Button } from "@/components/ui/Button";
import { watchLocation } from "@/utils/location";
import { Camera, LayoutList } from 'lucide-react'
import { cn } from '@/utils/cn'
import { SEVERITY_BADGE } from '@/config/severity'
import { createReportApi } from '@/utils/reportsApi'
// import { STATUS_CONFIG, type ReportStatus } from '@/config/status';

export default function UserPage() {
        // Initial Sample Data
    const initialReports: TrashReport[] = [
        { id: '1', lat: 14.4550, lng: 120.9520, severity: 'HIGH', details: 'Illegal dump site behind store', status: 'unresolved', createdAt: new Date().toISOString() },
        { id: '2', lat: 14.4552, lng: 120.9523, severity: 'HIGH', details: 'Heavy pile of garbage bags', status: 'unresolved', createdAt: new Date().toISOString() },
        { id: '3', lat: 14.4650, lng: 120.9450, severity: 'LOW', details: 'Single plastic cup on curb', status: 'unresolved', createdAt: new Date().toISOString() },
    ];

    

    const [reports, setReports] = useState<TrashReport[]>(initialReports);

    const [openDrawer, setOpenDrawer] = useState(false)
    const [showCamera, setShowCamera] = useState(false);

    const [userLoc, setUserLoc] = useState<MyLocation>({ lat: null, lng: null });
    const [userLocError, setuserLocError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'report' | 'list'>('report');

    const [capturedImages, setCapturedImages] = useState<string[]>([]);
    const [remarks, setRemarks] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleImageCapture = (imageData: string) => {
        if (capturedImages.length < 5) {
            setCapturedImages([...capturedImages, imageData]);
        } else {
            alert('Maximum 5 images allowed');
        }
    };

    const handleSubmitReport = async () => {
        if (capturedImages.length === 0) {
            alert('Please capture at least one image');
            return;
        }
        if (!remarks.trim()) {
            alert('Please add remarks');
            return;
        }
        if (userLoc.lat === null || userLoc.lng === null) {
            alert('Waiting for your GPS location — please try again in a moment.');
            return;
        }

        setIsSubmitting(true);
        try {
            // Severity is scored from the photos by the backend, not chosen here — which is
            // also where a "no trash in this photo" submission gets rejected.
            const report = await createReportApi({
                lat: userLoc.lat,
                lng: userLoc.lng,
                details: remarks.trim(),
                images: capturedImages,
            });
            setReports((prev) => [report, ...prev]);
            setCapturedImages([]);
            setRemarks('');
            setOpenDrawer(false);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Could not submit the report. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        const unwatch = watchLocation(
            (result) => {
                setUserLoc({ lat: result.lat, lng: result.lng });
                console.log('📍 Updated:', result.lat, result.lng);
            },
            (err) => {
                setuserLocError(err.message);
            }
        );
        return () => unwatch();
    }, []);

    return (
        <UserLayout>
            <TrashMap reports={reports} myLocation={userLoc} showLogo={true} pinOnMyLocation={true} />

            {/* DRAWER WRAPPER - THIS WAS MISSING */}
            <div
                className={`absolute inset-x-0 bottom-0 h-[85dvh] z-[9999] rounded-t-[30px] overflow-hidden bg-light transition-transform duration-300 ease-in-out ${openDrawer ? "translate-y-0" : "translate-y-[calc(100%)]"
                    }`}
            >
                {/* Top handle section */}
                <div
                    className="flex h-[40px] cursor-pointer flex-col items-center justify-center border-b px-4 bg-light-lighter"
                    onClick={() => setOpenDrawer(!openDrawer)}
                >
                    <div className="h-1.5 w-12 rounded-full bg-gray-300" />
                </div>

                {/* Drawer Body Content */}
                <div className="flex flex-col h-[calc(100%-40px)]">
                    {/* Tab Navigation */}
                    <div className="flex border-b border-gray-200 bg-light-lighter shrink-0">
                        <button
                            onClick={() => setActiveTab('report')}
                            className={cn(
                                "flex-1 py-3 text-sm font-medium transition-colors relative",
                                activeTab === 'report'
                                    ? "text-primary border-b-2 border-primary"
                                    : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <Camera className="w-4 h-4" />
                                Report
                                {capturedImages.length > 0 && (
                                    <span className="bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                        {capturedImages.length}
                                    </span>
                                )}
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('list')}
                            className={cn(
                                "flex-1 py-3 text-sm font-medium transition-colors relative",
                                activeTab === 'list'
                                    ? "text-primary border-b-2 border-primary"
                                    : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <LayoutList className="w-4 h-4" />
                                My Reports
                                <span className="bg-gray-200 text-gray-600 text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                    {reports.length}
                                </span>
                            </div>
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto p-4 pb-24">
                        {activeTab === 'report' ? (
                            // REPORT TAB
                            <div className="space-y-4">
                                {/* Image Upload Section */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Photos ({capturedImages.length}/5)
                                    </label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {capturedImages.map((image, index) => (
                                            <div key={index} className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                                                <img src={image} alt={`Capture ${index + 1}`} className="w-full h-full object-cover" />
                                                <button
                                                    onClick={() => setCapturedImages(capturedImages.filter((_, i) => i !== index))}
                                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                        {capturedImages.length < 5 && (
                                            <button
                                                onClick={() => setShowCamera(true)}
                                                className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center hover:border-primary transition-colors"
                                            >
                                                <Camera className="w-6 h-6 text-gray-400" />
                                                <span className="text-xs text-gray-400 mt-1">Add</span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Remarks */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Remarks
                                    </label>
                                    <textarea
                                        value={remarks}
                                        onChange={(e) => setRemarks(e.target.value)}
                                        placeholder="Describe the trash you found..."
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none h-24"
                                    />
                                </div>

                                {/* Submit Button */}
                                <Button
                                    onClick={handleSubmitReport}
                                    isLoading={isSubmitting}
                                    className="w-full bg-primary text-white py-3 rounded-full font-semibold"
                                    disabled={capturedImages.length === 0 || !remarks.trim()}
                                >
                                    Submit Report
                                </Button>
                            </div>
                        ) : (
                            // LIST TAB
                            <div className="space-y-3">
                                {reports.length === 0 ? (
                                    <div className="text-center py-10 text-gray-500">
                                        <LayoutList className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                                        <p>No reports yet</p>
                                        <p className="text-sm">Tap "Report" to submit your first report</p>
                                    </div>
                                ) : (
                                    reports.map((report) => (
                                        <div
                                            key={report.id}
                                            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={cn(
                                                            "text-xs font-semibold px-2 py-0.5 rounded-full",
                                                            SEVERITY_BADGE[report.severity]
                                                        )}>
                                                            {report.severity}
                                                        </span>

                                                        {/* Date */}
                                                        <span className="text-xs text-gray-400">
                                                            {new Date(parseInt(report.id) * 1000).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-700">{report.details}</p>
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        📍 {report.lat.toFixed(4)}, {report.lng.toFixed(4)}
                                                    </p>
                                                </div>
                                                
                                                {/* Status Badge - from your config */}
                                                {/* <StatusBadge status={report.status} /> */}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showCamera && (
                <div className="fixed inset-0 z-[99999] bg-black h-dvh w-full">
                    <ReportCamera
                        onClose={() => setShowCamera(false)}
                        onCapture={handleImageCapture}
                    />
                </div>
            )}

            {!openDrawer && !showCamera &&
                <div className="absolute bottom-5 right-4 z-[999] grid gap-3 justify-items-center">
                    <button className="p-3 rounded-full bg-dark hover:bg-dark-light" onClick={() => setOpenDrawer(true)}>
                        <LayoutList color="white" size={20} />
                    </button>
                    <button className="p-3 rounded-full bg-primary-dark hover:bg-primary" onClick={() => setShowCamera(true)}>
                        <Camera color="white" size={30} />
                    </button>
                </div>
            }
        </UserLayout>
    )
}