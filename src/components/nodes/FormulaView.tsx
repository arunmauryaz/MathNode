import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { isEquation, isSymbolic, toLatex } from '../../utils/symbolicMath';
import { formatValue } from '../../utils/graphRules';
export function FormulaView({
  value,
  precision = 8,
  className = '',
  title,
}: {
  value: unknown;
  precision?: number;
  className?: string;
  title?: string;
}) {
  const latex =
    isSymbolic(value) || isEquation(value)
      ? toLatex(value, true, precision)
      : '';
  const markup = useMemo(
    () =>
      latex
        ? katex.renderToString(`\\displaystyle ${latex}`, {
            throwOnError: false,
            trust: false,
            maxExpand: 1000,
            maxSize: 20,
            output: 'htmlAndMathml',
          })
        : '',
    [latex],
  );
  const text = formatValue(value, precision);
  return (
    <pre
      title={title || text}
      aria-label={text}
      data-formula-latex={latex || undefined}
      className={className}
      style={{ whiteSpace: latex ? 'normal' : 'pre-wrap' }}
    >
      {latex ? <span dangerouslySetInnerHTML={{ __html: markup }} /> : text}
    </pre>
  );
}
export function ScalarField({
  value,
  onChange,
  onBegin,
  onEnd,
  label,
  min,
  max,
  step = 1,
}: {
  value: unknown;
  onChange: (value: string | number) => void;
  onBegin: () => void;
  onEnd: () => void;
  label: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  const clamp = (n: number) =>
    Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n));
  return (
    <input
      aria-label={label}
      title="Number, symbol (A), or LaTeX (\\frac{A}{B})"
      type="text"
      className="h-[28px] min-w-0 w-full px-2 text-right rounded-[5px] bg-[#141417] border border-[#2C2C34] text-[11px] text-white font-mono focus:outline-none focus:border-[#4B78D8]"
      value={String(value ?? 0)}
      onFocus={onBegin}
      onChange={(e) => {
        onBegin();
        const s = e.target.value;
        onChange(s.trim() && Number.isFinite(Number(s)) ? clamp(Number(s)) : s);
      }}
      onBlur={onEnd}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') e.currentTarget.blur();
        if (
          (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
          typeof value === 'number'
        ) {
          e.preventDefault();
          onBegin();
          onChange(clamp(value + (e.key === 'ArrowUp' ? step : -step)));
        }
      }}
    />
  );
}
