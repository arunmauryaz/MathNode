import { ComputeEngine } from '@cortex-js/compute-engine';
let engine: ComputeEngine | undefined;
const cache = new Map<string, ReturnType<ComputeEngine['parse']>>();
export function computeEngine() {
  return engine || (engine = new ComputeEngine({ precision: 'machine' }));
}
export function normalizeLatex(source: string): string {
  return source
    .trim()
    .replace(/^\$\$?([\s\S]*?)\$\$?$/, '$1')
    .replace(/^\\\[([\s\S]*)\\\]$/, '$1')
    .replace(
      /\b(asin|acos|atan)\s*\(/g,
      (_, name: string) => `\\arc${name.slice(1)}(`,
    )
    .replace(
      /(?<!\\)\b(sqrt|sin|cos|tan|sinh|cosh|tanh|ln|log|exp|abs)\s*\(/g,
      (_, name: string) => (name === 'sqrt' ? '\\sqrt(' : `\\${name}(`),
    )
    .replace(/\*/g, '\\cdot ');
}
export function parseLatex(source: string) {
  const latex = normalizeLatex(source);
  if (!latex || latex.length > 4096)
    throw new Error('Enter a formula of at most 4096 characters');
  const existing = cache.get(latex);
  if (existing) return existing;
  const ce = computeEngine();
  const parsed = ce.withTimeLimit(150, () => ce.parse(latex));
  if (!parsed.isValid)
    throw new Error('Invalid mathematical expression or LaTeX syntax');
  const forbidden = new Set([
    'Assign',
    'Declare',
    'Set',
    'Define',
    'Assume',
    'Forget',
  ]);
  const inspect = (value: unknown): boolean =>
    Array.isArray(value) &&
    (forbidden.has(String(value[0])) || value.some(inspect));
  if (inspect(parsed.json))
    throw new Error(
      'Use Substitute to assign values; expressions cannot change global state',
    );
  if (cache.size > 256) cache.clear();
  cache.set(latex, parsed);
  return parsed;
}
export function evaluateLatex(
  latex: string,
  values: Map<string, number>,
): number | undefined {
  const ce = computeEngine();
  return ce.withTimeLimit(150, () => {
    const expression = parseLatex(latex).subs(Object.fromEntries(values));
    if (expression.unknowns.length) return undefined;
    const result = expression.N();
    if (result.isNumber !== true) return undefined;
    if (!Number.isFinite(result.re) || result.im !== 0)
      throw new Error('Formula has no finite real numerical result');
    return result.re;
  });
}
