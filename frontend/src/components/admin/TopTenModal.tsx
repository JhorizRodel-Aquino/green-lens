import { X } from 'lucide-react';

type TopTenModalProps = {
    title: string;
    items: { name: string; value: string }[];
    onClose: () => void;
};

export default function TopTenModal({ title, items, onClose }: TopTenModalProps) {
    return (
        <div className="fixed inset-0 z-[2001] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl overflow-hidden max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between px-4 h-14 border-b border-light-dark shrink-0">
                    <h3 className="text-sm font-bold text-dark">{title}</h3>
                    <button type="button" onClick={onClose} aria-label="Close" className="text-dark-light hover:text-dark">
                        <X size={20} />
                    </button>
                </div>

                <div className="overflow-y-auto p-4 space-y-2">
                    {items.length === 0 && <p className="text-sm text-dark-light text-center py-6">No data yet.</p>}
                    {items.map((item, i) => (
                        <div key={item.name} className="flex items-center gap-3 rounded-lg border border-light-dark px-3 py-2">
                            <div className="h-7 w-7 shrink-0 rounded-full bg-light text-dark flex items-center justify-center font-bold text-xs">
                                {i + 1}
                            </div>
                            <span className="flex-1 min-w-0 truncate text-sm text-dark" title={item.name}>{item.name}</span>
                            <span className="shrink-0 text-sm font-bold text-dark">{item.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
