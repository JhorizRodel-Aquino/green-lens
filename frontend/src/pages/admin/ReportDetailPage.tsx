import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    ChevronRight, MapPin, ImageOff, CheckCircle2, Camera, Upload, CircleCheck,
    FileWarning, ShieldAlert, MessageSquarePlus, RotateCcw, MapPinOff,
} from 'lucide-react';
import { useReports } from '@/context/ReportsContext';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/components/ui/Notifications';
import { FLAG_REASON_LABELS } from '@/components/map/TrashMap';
import { SEVERITY_BADGE_CLASSES } from '@/config/severity';
import { Button } from '@/components/ui/Button';
import ReportCamera from '@/components/ReportCamera';
import ImageCarousel from '@/components/admin/ImageCarousel';
import AssignJurisdictionForm from '@/components/admin/AssignJurisdictionForm';
import DirectionsModal from '@/components/admin/DirectionsModal';
import { cn } from '@/utils/cn';

function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
}

export default function ReportDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { reports, resolveReport, reopenReport, addRemark, assignJurisdiction } = useReports();
    const { user } = useAuth();
    const { toast, confirm } = useNotifications();
    const [afterImages, setAfterImages] = useState<string[]>([]);
    const [showCamera, setShowCamera] = useState(false);
    const [remarkText, setRemarkText] = useState('');
    const [resolveNote, setResolveNote] = useState('');
    const [reopenNote, setReopenNote] = useState('');
    const [showReopenForm, setShowReopenForm] = useState(false);
    const [showDirections, setShowDirections] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const report = reports.find((r) => r.id === id);
    const isResolved = report?.status === 'resolved';
    const isFlagged = report?.status === 'flagged';

    const addAfterFiles = (files: File[]) => {
        const images = files.filter((f) => f.type.startsWith('image/'));
        if (images.length === 0) return;
        setAfterImages((prev) => [...prev, ...images.map((f) => URL.createObjectURL(f))]);
    };

    // Global paste-to-upload for the After photo, while this report isn't resolved yet
    useEffect(() => {
        if (isResolved) return;
        const handlePaste = (e: ClipboardEvent) => {
            const files = Array.from(e.clipboardData?.files ?? []);
            addAfterFiles(files);
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [isResolved]);

    if (!report) {
        return (
            <div className="p-4 md:p-6">
                <p className="text-sm text-dark-light">Report not found.</p>
                <Link to="/admin/reports" className="text-sm text-primary font-medium">Back to Reports</Link>
            </div>
        );
    }

    const historyEvents = (report.remarks ?? [])
        .filter((r) => r.kind === 'RESOLUTION' || r.kind === 'REOPEN')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const beforeImages = report.imageUrls ?? [];
    const activeAfterImages = report.resolutionProofUrls?.length ? report.resolutionProofUrls : afterImages;

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        addAfterFiles(Array.from(e.target.files ?? []));
        e.target.value = '';
    };

    const handleAfterDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (isResolved) return;
        addAfterFiles(Array.from(e.dataTransfer.files));
    };

    const handleResolve = async () => {
        if (afterImages.length === 0) return;
        try {
            await resolveReport(report.id, afterImages, resolveNote.trim() || undefined);
            toast('success', 'Report marked as resolved.');
            navigate('/admin/reports');
        } catch (err) {
            toast('error', err instanceof Error ? err.message : 'Failed to resolve report');
        }
    };

    const handleReopen = async () => {
        const text = reopenNote.trim();
        if (!text) return;
        const ok = await confirm({
            title: 'Reopen this report?',
            message: 'This moves it back to Unresolved so it can be worked on again.',
            confirmLabel: 'Reopen Report',
            tone: 'danger',
        });
        if (!ok) return;

        try {
            await reopenReport(report.id, text);
            setReopenNote('');
            setShowReopenForm(false);
            toast('success', 'Report reopened.');
        } catch (err) {
            toast('error', err instanceof Error ? err.message : 'Failed to reopen report');
        }
    };

    const handleAddRemark = () => {
        const text = remarkText.trim();
        if (!text) return;
        addRemark(report.id, text);
        setRemarkText('');
    };


    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-sm text-dark-light">
                <Link to="/admin/reports" className="hover:text-primary">Reports</Link>
                <ChevronRight size={14} />
                <span className="text-dark font-medium">Report #{report.id}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[35%_65%] gap-6 items-start">
                {/* Left column: full info + lifecycle */}
                <div className="space-y-6">
                    <div className="rounded-xl border border-light-dark bg-white p-4 md:p-6 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-2">
                                <span className={cn(
                                    'rounded-full px-3 py-1 text-xs font-semibold',
                                    SEVERITY_BADGE_CLASSES[report.severity]
                                )}>
                                    {report.severity} SEVERITY
                                </span>
                                <span className={cn(
                                    'rounded-full px-3 py-1 text-xs font-semibold capitalize',
                                    report.status === 'resolved' && 'bg-primary-light/20 text-primary-dark',
                                    report.status === 'flagged' && 'bg-secondary-light/30 text-secondary-dark',
                                    report.status === 'unresolved' && 'bg-light-dark text-dark-light',
                                    report.status === 'pending' && 'bg-yellow-100 text-yellow-700'
                                )}>
                                    {report.status}
                                </span>
                            </div>
                            <span className="text-xs text-dark-light">Reported {formatDateTime(report.createdAt)}</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-dark-light">GPS Coordinates</p>
                                <button
                                    type="button"
                                    onClick={() => setShowDirections(true)}
                                    className="text-sm text-primary hover:underline mt-0.5"
                                >
                                    {report.lat.toFixed(6)}, {report.lng.toFixed(6)}
                                </button>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-dark-light">Location</p>
                                <p className="text-sm text-dark mt-0.5 flex items-start gap-1.5">
                                    <MapPin size={16} className="shrink-0 mt-0.5 text-dark-light" />
                                    {report.locationLabel ?? 'Location unavailable'}
                                </p>
                            </div>
                        </div>

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-dark-light">Description</p>
                            <p className="text-sm text-dark mt-0.5">{report.details}</p>
                        </div>

                        {report.flagReason && (
                            <div className="flex items-center gap-2 rounded-lg bg-secondary-light/20 px-3 py-2 text-sm text-secondary-dark">
                                <ShieldAlert size={16} className="shrink-0" />
                                Flagged as: {FLAG_REASON_LABELS[report.flagReason]}
                            </div>
                        )}
                    </div>

                    {report.jurisdictionStatus === 'UNASSIGNED' && user?.role === 'SUPER_ADMIN' && (
                        <div className="rounded-xl border border-secondary bg-secondary-light/10 p-4 md:p-6 space-y-3">
                            <div className="flex items-center gap-2 text-secondary-dark">
                                <MapPinOff size={18} className="shrink-0" />
                                <h2 className="text-sm font-semibold">Unassigned — no LGU can see this report</h2>
                            </div>
                            <AssignJurisdictionForm
                                onAssign={async (payload) => {
                                    try {
                                        await assignJurisdiction(report.id, payload);
                                        toast('success', 'Jurisdiction assigned.');
                                    } catch (err) {
                                        toast('error', err instanceof Error ? err.message : 'Failed to assign jurisdiction');
                                    }
                                }}
                            />
                        </div>
                    )}

                    <div className="rounded-xl border border-light-dark bg-white p-4 md:p-6">
                        <h2 className="text-sm font-semibold text-dark mb-4">Report Lifecycle</h2>
                        <ol className="relative border-l-2 border-light-dark ml-2 space-y-6">
                            <li className="ml-4">
                                <span className="absolute -left-[7px] h-3 w-3 rounded-full bg-primary" />
                                <p className="text-sm font-medium text-dark">Reported</p>
                                <p className="text-xs text-dark-light">{formatDateTime(report.createdAt)}</p>
                            </li>

                            {report.flaggedAt && (
                                <li className="ml-4">
                                    <span className="absolute -left-[7px] h-3 w-3 rounded-full bg-secondary" />
                                    <p className="text-sm font-medium text-dark">Flagged</p>
                                    <p className="text-xs text-dark-light">{formatDateTime(report.flaggedAt)}</p>
                                </li>
                            )}

                            {historyEvents.map((event, i) => (
                                <li key={i} className="ml-4">
                                    <span className={cn(
                                        'absolute -left-[7px] h-3 w-3 rounded-full',
                                        event.kind === 'REOPEN' ? 'bg-yellow-500' : 'bg-primary'
                                    )} />
                                    <p className="text-sm font-medium text-dark">{event.kind === 'REOPEN' ? 'Reopened' : 'Resolved'}</p>
                                    <p className="text-xs text-dark-light">{formatDateTime(event.createdAt)}</p>
                                    {event.kind === 'REOPEN' && (
                                        <p className="text-xs text-dark-light mt-0.5 italic">"{event.text.replace(/^Reopened: /, '')}"</p>
                                    )}
                                </li>
                            ))}

                            {!report.resolvedAt && (
                                <li className="ml-4">
                                    <span className="absolute -left-[7px] h-3 w-3 rounded-full bg-light-dark border-2 border-white" />
                                    <p className="text-sm font-medium text-dark-light">Awaiting resolution</p>
                                </li>
                            )}
                        </ol>
                    </div>
                </div>

                {/* Right column: resolution proof + LGU remarks */}
                <div className="space-y-6">
                    <div className="rounded-xl border border-light-dark bg-white p-4 md:p-6 space-y-4">
                        <h2 className="text-sm font-semibold text-dark">Resolution Proof</h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-dark-light mb-2">Before (uploaded by reporter)</p>
                                <ImageCarousel images={beforeImages} emptyIcon={ImageOff} emptyLabel="No image provided" />
                            </div>

                            <div
                                onDrop={handleAfterDrop}
                                onDragOver={(e) => !isResolved && !isFlagged && e.preventDefault()}
                            >
                                <p className="text-xs font-semibold uppercase tracking-wide text-dark-light mb-2">After</p>
                                <ImageCarousel images={activeAfterImages} emptyIcon={FileWarning} emptyLabel="No resolution photo yet · drag & drop or paste" />

                                {!isResolved && !isFlagged && (
                                    <div className="flex gap-2 mt-2">
                                        <Button variant="outline" size="sm" leftIcon={Camera} onClick={() => setShowCamera(true)}>
                                            Camera
                                        </Button>
                                        <Button variant="outline" size="sm" leftIcon={Upload} onClick={() => fileInputRef.current?.click()}>
                                            Upload
                                        </Button>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                            onChange={handleFileUpload}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {isFlagged && (
                            <div className="flex items-center gap-2 rounded-lg bg-secondary-light/20 px-4 py-3 text-sm text-secondary-dark">
                                <ShieldAlert size={18} className="shrink-0" />
                                This report is flagged and cannot be resolved.
                            </div>
                        )}

                        {!isResolved && !isFlagged && (
                            <div className="space-y-2">
                                <textarea
                                    value={resolveNote}
                                    onChange={(e) => setResolveNote(e.target.value)}
                                    placeholder="Resolution notes (optional)..."
                                    rows={2}
                                    className="w-full rounded-lg border border-light-dark bg-white px-3 py-2 text-sm text-dark focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                                <div className="flex justify-end">
                                    <Button
                                        variant="primary"
                                        leftIcon={CircleCheck}
                                        disabled={afterImages.length === 0}
                                        onClick={handleResolve}
                                        className="rounded-lg"
                                    >
                                        Resolve Report
                                    </Button>
                                </div>
                            </div>
                        )}

                        {isResolved && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 rounded-lg bg-primary-light/20 px-4 py-3 text-sm text-primary-dark">
                                    <CheckCircle2 size={18} className="shrink-0" />
                                    This report has been resolved.
                                </div>

                                {!showReopenForm ? (
                                    <div className="flex justify-end">
                                        <Button variant="outline" size="sm" leftIcon={RotateCcw} onClick={() => setShowReopenForm(true)}>
                                            Reopen Report
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <textarea
                                            value={reopenNote}
                                            onChange={(e) => setReopenNote(e.target.value)}
                                            placeholder="Why is this being reopened? e.g. trash wasn't actually collected..."
                                            rows={2}
                                            className="w-full rounded-lg border border-light-dark bg-white px-3 py-2 text-sm text-dark focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                        <div className="flex justify-end gap-2">
                                            <Button variant="outline" size="sm" onClick={() => setShowReopenForm(false)}>
                                                Cancel
                                            </Button>
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                leftIcon={RotateCcw}
                                                disabled={!reopenNote.trim()}
                                                onClick={handleReopen}
                                            >
                                                Confirm Reopen
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border border-light-dark bg-white p-4 md:p-6 space-y-4">
                        <h2 className="text-sm font-semibold text-dark">LGU Remarks</h2>

                        {report.remarks && report.remarks.length > 0 ? (
                            <ul className="space-y-3">
                                {report.remarks.map((remark, i) => (
                                    <li key={i} className="rounded-lg bg-light px-3 py-2">
                                        <p className="text-sm text-dark">{remark.text}</p>
                                        <p className="text-xs text-dark-light mt-1">{formatDateTime(remark.createdAt)}</p>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-dark-light">No remarks yet.</p>
                        )}

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={remarkText}
                                onChange={(e) => setRemarkText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddRemark()}
                                placeholder="Add a remark..."
                                className="flex-1 rounded-lg border border-light-dark bg-white px-3 py-2 text-sm text-dark focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <Button variant="outline" size="sm" leftIcon={MessageSquarePlus} onClick={handleAddRemark}>
                                Add
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {showCamera && (
                <div className="fixed inset-0 z-[99999] bg-black h-dvh w-full">
                    <ReportCamera
                        onClose={() => setShowCamera(false)}
                        onCapture={(url) => {
                            setAfterImages((prev) => [...prev, url]);
                            setShowCamera(false);
                        }}
                    />
                </div>
            )}

            {showDirections && (
                <DirectionsModal lat={report.lat} lng={report.lng} onClose={() => setShowDirections(false)} />
            )}
        </div>
    );
}
