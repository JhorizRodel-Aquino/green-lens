import { useState } from 'react';
import type { ComponentType } from 'react';
import * as LucideIcons from 'lucide-react';

// Non-icon exports that structurally look like icon components but aren't
const EXCLUDED_EXPORTS = new Set(['Icon', 'icons', 'createLucideIcon', 'LucideProvider', 'useLucideContext']);

type IconEntry = { name: string; component: ComponentType<{ className?: string }> };

// Render every icon lucide-react ships, deduped (many names alias the same component)
const icons: IconEntry[] = Object.entries(LucideIcons)
  .filter(
    ([name, value]) =>
      !EXCLUDED_EXPORTS.has(name) &&
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { render?: unknown }).render === 'function'
  )
  .reduce<IconEntry[]>((acc, [name, component]) => {
    if (!acc.some((i) => i.component === component)) {
      acc.push({ name, component: component as IconEntry['component'] });
    }
    return acc;
  }, [])
  .sort((a, b) => a.name.localeCompare(b.name));

export default function IconGallery() {
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const filteredIcons = icons.filter((icon) =>
    icon.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-dvh">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <h1 className="text-2xl font-bold">Lucide Icons</h1>
        <p className="text-sm text-gray-500">{filteredIcons.length} icons</p>
      </div>

      {/* Search */}
      <div className="max-w-6xl mx-auto mb-6">
        <input
          type="text"
          placeholder="Search icons..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Toast */}
      {copied && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-2 rounded-lg text-sm z-50">
          Copied: {copied}
        </div>
      )}

      {/* Grid */}
      <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
        {filteredIcons.map(({ name, component: Icon }) => (
          <div
            key={name}
            className="flex flex-col items-center justify-center p-3 bg-white rounded-lg border border-gray-200 hover:border-primary hover:shadow-md transition-all"
          >
            <Icon className="w-6 h-6 text-gray-700" />
            <span className="mt-1 text-[10px] text-gray-500 text-center break-all">
              {name}
            </span>
            <div className="mt-1.5 flex gap-1">
              <button
                type="button"
                onClick={() => handleCopy(name)}
                title={`Copy "${name}"`}
                className="text-[9px] leading-none px-1.5 py-1 rounded bg-gray-100 hover:bg-primary hover:text-white text-gray-600 transition-colors"
              >
                name
              </button>
              <button
                type="button"
                onClick={() => handleCopy(`<${name} />`)}
                title={`Copy <${name} />`}
                className="text-[9px] leading-none px-1.5 py-1 rounded bg-gray-100 hover:bg-primary hover:text-white text-gray-600 transition-colors"
              >
                {'</>'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}