import { useEffect, useState } from 'react';
export function VectorField({
  value,
  onChange,
  onBegin,
  onEnd,
  label,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
  onBegin: () => void;
  onEnd: () => void;
  label: string;
}) {
  const [draft, setDraft] = useState(String(value ?? '')),
    [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(String(value ?? ''));
  }, [value, focused]);
  return (
    <input
      aria-label={label}
      aria-invalid={!Array.isArray(value)}
      title="Numeric vector: 1, 2, 3 (commas, spaces, or semicolons)"
      type="text"
      className="h-[28px] min-w-0 w-full px-2 text-right rounded-[5px] bg-[#141417] border border-[#2C2C34] text-[11px] text-white font-mono focus:outline-none focus:border-[#4B78D8]"
      value={draft}
      onFocus={() => {
        setFocused(true);
        onBegin();
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const source = draft
            .trim()
            .replace(/^\[([\s\S]*)\]$/, '$1')
            .trim(),
          numbers = source.split(/[\s,;]+/).map(Number);
        onChange(
          source && numbers.length <= 10000 && numbers.every(Number.isFinite)
            ? numbers
            : draft,
        );
        setFocused(false);
        onEnd();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}
