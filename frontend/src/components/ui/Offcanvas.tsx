import { type ReactNode } from 'react';
import { X } from 'lucide-react';

type OffcanvasProps = {
    open: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
};

export default function Offcanvas({ open, onClose, title, children }: OffcanvasProps) {
    return (
        <div className={open ? 'fixed inset-0 z-50' : 'pointer-events-none fixed inset-0 z-50'} aria-hidden={!open}>
            <div
                className={`absolute inset-0 bg-black/40 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            />
            <div
                className={`absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl transition-transform duration-300 flex flex-col ${
                    open ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                <div className="flex items-center justify-between p-4 border-b border-light-dark">
                    <h2 className="text-lg font-bold text-dark">{title}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-dark-light hover:bg-light rounded-lg transition-colors"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 md:p-6">{children}</div>
            </div>
        </div>
    );
}
