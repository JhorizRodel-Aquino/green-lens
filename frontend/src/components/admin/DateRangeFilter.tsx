import type { DatePreset } from '@/utils/reportStats';

type DateRangeFilterProps = {
    preset: DatePreset;
    onPresetChange: (preset: DatePreset) => void;
    customFrom: string;
    onCustomFromChange: (value: string) => void;
    customTo: string;
    onCustomToChange: (value: string) => void;
};

const inputClasses = 'rounded-lg border border-light-dark bg-white px-3 py-1.5 text-sm text-dark focus:outline-none focus:ring-2 focus:ring-primary';

export default function DateRangeFilter({
    preset, onPresetChange, customFrom, onCustomFromChange, customTo, onCustomToChange,
}: DateRangeFilterProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <select
                value={preset}
                onChange={(e) => onPresetChange(e.target.value as DatePreset)}
                className={inputClasses}
            >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="custom">Custom range</option>
            </select>

            {preset === 'custom' && (
                <>
                    <input
                        type="date"
                        value={customFrom}
                        onChange={(e) => onCustomFromChange(e.target.value)}
                        className={inputClasses}
                    />
                    <span className="text-dark-light text-sm">to</span>
                    <input
                        type="date"
                        value={customTo}
                        onChange={(e) => onCustomToChange(e.target.value)}
                        className={inputClasses}
                    />
                </>
            )}
        </div>
    );
}
