import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

type StatCardProps = {
    label: string;
    value: string;
    icon: LucideIcon;
    tone?: 'default' | 'danger' | 'success' | 'accent';
    trend?: { direction: 'up' | 'down'; label: string; tone?: 'success' | 'danger' | 'neutral' };
    onClick?: () => void;
};

const TONE_CLASSES: Record<NonNullable<StatCardProps['tone']>, string> = {
    default: 'bg-light text-dark-light',
    danger: 'bg-red-100 text-red-600',
    success: 'bg-primary-light/20 text-primary-dark',
    accent: 'bg-secondary-light/30 text-secondary-dark',
};

const TREND_CLASSES: Record<'success' | 'danger' | 'neutral', string> = {
    success: 'text-primary-dark',
    danger: 'text-red-600',
    neutral: 'text-dark-light',
};

export default function StatCard({ label, value, icon: Icon, tone = 'default', trend, onClick }: StatCardProps) {
    const TrendIcon = trend?.direction === 'down' ? TrendingDown : TrendingUp;

    return (
        <div
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
            className={cn(
                'flex flex-col gap-3 rounded-xl border border-light-dark bg-white p-4',
                onClick && 'cursor-pointer transition-shadow hover:shadow-md hover:border-primary/40'
            )}
        >
            <div className="flex items-center gap-3">
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', TONE_CLASSES[tone])}>
                    <Icon size={20} />
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-medium text-dark-light truncate">{label}</p>
                    <p className="text-xl font-bold text-dark">{value}</p>
                </div>
            </div>

            {trend && (
                <div className={cn('flex items-center gap-1 text-xs font-medium', TREND_CLASSES[trend.tone ?? 'success'])}>
                    <TrendIcon size={14} />
                    {trend.label}
                </div>
            )}
        </div>
    );
}
