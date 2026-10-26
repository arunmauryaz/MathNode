import { collections } from './mathLibrary';
import {
  computeEngine,
  evaluateLatex,
  normalizeLatex,
  parseLatex,
} from './latexRuntime';
export type BinaryOperator = '+' | '-' | '*' | '/' | '^' | '%';
export type FunctionName =
  'sin' | 'cos' | 'tan' | 'sqrt' | 'abs' | 'ln' | 'exp' | 'square';
export type Expression =
  | { type: 'number'; value: number }
  | { type: 'latex'; latex: string; bindings?: Record<string, number> }
  | { type: 'symbol'; name: string; binding?: number }
  | {
      type: 'binary';
      operator: BinaryOperator;
      left: Expression;
      right: Expression;
    }
  | { type: 'function'; name: FunctionName; argument: Expression };
export interface SymbolicScalar {
  kind: 'math-expression';
  expression: Expression;
}
export interface Equation {
  kind: 'math-equation';
  left: Expression;
  right: Expression;
}
export type Scalar = number | SymbolicScalar;
const operators = new Set(['+', '-', '*', '/', '^', '%']);
const functions = new Set([
  'sin',
  'cos',
  'tan',
  'sqrt',
  'abs',
  'ln',
  'exp',
  'square',
]);
const identifier = /^[\p{L}_][\p{L}\p{N}_]*$/u;
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function validExpression(root: unknown): root is Expression {
  const queue: { value: unknown; depth: number }[] = [
    { value: root, depth: 0 },
  ];
  let count = 0;
  while (queue.length) {
    const { value: v, depth } = queue.pop()!;
    if (!object(v) || depth > 64 || ++count > 2048) return false;
    if (v.type === 'latex') {
      if (
        typeof v.latex !== 'string' ||
        !v.latex ||
        v.latex.length > 4096 ||
        (v.bindings !== undefined &&
          (!object(v.bindings) ||
            !Object.entries(v.bindings).every(
              ([name, n]) =>
                identifier.test(name) &&
                typeof n === 'number' &&
                Number.isFinite(n),
            )))
      )
        return false;
    } else if (v.type === 'number') {
      if (typeof v.value !== 'number' || !Number.isFinite(v.value))
        return false;
    } else if (v.type === 'symbol') {
      if (
        typeof v.name !== 'string' ||
        v.name.length > 64 ||
        !identifier.test(v.name) ||
        (v.binding !== undefined &&
          (typeof v.binding !== 'number' || !Number.isFinite(v.binding)))
      )
        return false;
    } else if (v.type === 'binary' && operators.has(String(v.operator)))
      queue.push(
        { value: v.left, depth: depth + 1 },
        { value: v.right, depth: depth + 1 },
      );
    else if (v.type === 'function' && functions.has(String(v.name)))
      queue.push({ value: v.argument, depth: depth + 1 });
    else return false;
  }
  return true;
}
export function isSymbolic(value: unknown): value is SymbolicScalar {
  return (
    object(value) &&
    value.kind === 'math-expression' &&
    validExpression(value.expression)
  );
}
export function isEquation(value: unknown): value is Equation {
  return (
    object(value) &&
    value.kind === 'math-equation' &&
    validExpression(value.left) &&
    validExpression(value.right)
  );
}
function expression(value: unknown): Expression {
  if (typeof value === 'number' && Number.isFinite(value))
    return { type: 'number', value };
  if (isSymbolic(value)) return structuredClone(value.expression);
  throw new Error('Expected a number or symbolic scalar');
}
function bindings(...roots: Expression[]): Map<string, number> {
  const map = new Map<string, number>();
  const queue = [...roots];
  while (queue.length) {
    const e = queue.pop()!;
    if (e.type === 'latex' && e.bindings) {
      for (const [name, value] of Object.entries(e.bindings)) {
        if (map.has(name) && map.get(name) !== value)
          throw new Error(`Conflicting values for variable ${name}`);
        map.set(name, value);
      }
    } else if (e.type === 'symbol' && e.binding !== undefined) {
      if (map.has(e.name) && map.get(e.name) !== e.binding)
        throw new Error(`Conflicting values for variable ${e.name}`);
      map.set(e.name, e.binding);
    } else if (e.type === 'binary') queue.push(e.left, e.right);
    else if (e.type === 'function') queue.push(e.argument);
  }
  return map;
}
function calculate(operator: BinaryOperator, a: number, b: number): number {
  if ((operator === '/' || operator === '%') && b === 0)
    throw new Error(operator === '/' ? 'Division by zero' : 'Modulo by zero');
  const result =
    operator === '+'
      ? a + b
      : operator === '-'
        ? a - b
        : operator === '*'
          ? a * b
          : operator === '/'
            ? a / b
            : operator === '^'
              ? Math.pow(a, b)
              : a % b;
  if (!Number.isFinite(result))
    throw new Error('Operation has no finite real result');
  return result;
}
function calculateFunction(name: FunctionName, value: number): number {
  if (name === 'sqrt' && value < 0)
    throw new Error('sqrt requires a non-negative real value');
  if (name === 'ln' && value <= 0)
    throw new Error('ln requires a positive real value');
  const result =
    name === 'square'
      ? value * value
      : name === 'ln'
        ? Math.log(value)
        : Math[name](value);
  if (!Number.isFinite(result))
    throw new Error('Function has no finite real result');
  return result;
}
function evaluate(
  e: Expression,
  values: Map<string, number>,
): number | undefined {
  if (e.type === 'latex') return evaluateLatex(e.latex, values);
  if (e.type === 'number') return e.value;
  if (e.type === 'symbol') return values.get(e.name);
  if (e.type === 'function') {
    const a = evaluate(e.argument, values);
    return a === undefined ? undefined : calculateFunction(e.name, a);
  }
  const a = evaluate(e.left, values),
    b = evaluate(e.right, values);
  if ((e.operator === '/' || e.operator === '%') && b === 0)
    throw new Error(e.operator === '/' ? 'Division by zero' : 'Modulo by zero');
  return a === undefined || b === undefined
    ? undefined
    : calculate(e.operator, a, b);
}
export function numericValue(value: Scalar): number | undefined {
  if (typeof value === 'number') return value;
  return evaluate(value.expression, bindings(value.expression));
}
function scalar(e: Expression): Scalar {
  if (!validExpression(e))
    throw new Error('Expression is too large or too deeply nested');
  evaluate(e, bindings(e));
  return e.type === 'number'
    ? e.value
    : { kind: 'math-expression', expression: e };
}
export function variable(name: unknown, binding?: unknown): SymbolicScalar {
  if (
    typeof name !== 'string' ||
    !identifier.test(name.trim()) ||
    name.trim().length > 64
  )
    throw new Error(
      'Use a variable name such as A, B, x, or alpha (letters, digits and underscores)',
    );
  if (
    binding !== undefined &&
    (typeof binding !== 'number' || !Number.isFinite(binding))
  )
    throw new Error('Variable value must be a finite number');
  return {
    kind: 'math-expression',
    expression: {
      type: 'symbol',
      name: name.trim(),
      ...(binding !== undefined ? { binding: binding as number } : {}),
    },
  };
}
export function operate(operation: string, a: unknown, b: unknown): Scalar {
  const operator = operation.includes('+')
    ? '+'
    : operation.includes('-')
      ? '-'
      : operation.includes('*') || operation.includes('\u00d7')
        ? '*'
        : operation.includes('/') || operation.includes('\u00f7')
          ? '/'
          : operation.includes('^')
            ? '^'
            : operation.includes('%')
              ? '%'
              : undefined;
  if (!operator) throw new Error('Unknown arithmetic operation');
  const left = expression(a),
    right = expression(b);
  bindings(left, right);
  // Resolve domain errors before simplifying identities such as A * 0.
  const full: Expression = { type: 'binary', operator, left, right };
  evaluate(full, bindings(full));
  if (left.type === 'number' && right.type === 'number')
    return calculate(operator, left.value, right.value);
  if (
    (operator === '+' || operator === '-') &&
    right.type === 'number' &&
    right.value === 0
  )
    return scalar(left);
  if (operator === '+' && left.type === 'number' && left.value === 0)
    return scalar(right);
  if (
    (operator === '*' || operator === '/') &&
    right.type === 'number' &&
    right.value === 1
  )
    return scalar(left);
  if (operator === '*' && left.type === 'number' && left.value === 1)
    return scalar(right);
  if (
    operator === '*' &&
    ((left.type === 'number' && left.value === 0) ||
      (right.type === 'number' && right.value === 0))
  )
    return 0;
  return scalar(full);
}
export function applyFunction(selection: string, value: unknown): Scalar {
  const name: FunctionName | undefined = selection.includes('sqrt')
    ? 'sqrt'
    : selection.includes('sin')
      ? 'sin'
      : selection.includes('cos')
        ? 'cos'
        : selection.includes('tan')
          ? 'tan'
          : selection.includes('abs')
            ? 'abs'
            : selection.includes('ln')
              ? 'ln'
              : selection.includes('exp')
                ? 'exp'
                : selection.includes('^2')
                  ? 'square'
                  : undefined;
  if (!name) throw new Error('Unknown mathematical function');
  const argument = expression(value);
  return argument.type === 'number'
    ? calculateFunction(name, argument.value)
    : scalar({ type: 'function', name, argument });
}
export function equation(a: unknown, b: unknown): Equation {
  const left = expression(a),
    right = expression(b);
  const values = bindings(left, right);
  evaluate(left, values);
  evaluate(right, values);
  return { kind: 'math-equation', left, right };
}
export function validateMath(value: SymbolicScalar | Equation): void {
  if (value.kind === 'math-equation') {
    const values = bindings(value.left, value.right);
    evaluate(value.left, values);
    evaluate(value.right, values);
  } else numericValue(value);
}
const precedence = (e: Expression) =>
  e.type !== 'binary'
    ? 4
    : e.operator === '^'
      ? 3
      : ['*', '/', '%'].includes(e.operator)
        ? 2
        : 1;
function render(e: Expression, number: (n: number) => string): string {
  if (e.type === 'latex') return parseLatex(e.latex).toString();
  if (e.type === 'number') return number(e.value);
  if (e.type === 'symbol') return e.name;
  if (e.type === 'function')
    return e.name === 'square'
      ? `(${render(e.argument, number)})^2`
      : `${e.name}(${render(e.argument, number)})`;
  const child = (c: Expression, right: boolean) => {
    const p = precedence(c),
      parent = precedence(e);
    const wrap =
      p < parent ||
      (p === parent &&
        (e.operator === '^'
          ? !right
          : right && ['-', '/', '%', '*'].includes(e.operator))) ||
      (c.type === 'number' && c.value < 0 && e.operator === '^');
    return wrap ? `(${render(c, number)})` : render(c, number);
  };
  return `${child(e.left, false)} ${e.operator === '*' ? '\u00d7' : e.operator} ${child(e.right, true)}`;
}
export function formatMath(
  value: SymbolicScalar | Equation,
  number: (n: number) => string,
): string {
  if (isEquation(value))
    return `${render(value.left, number)} = ${render(value.right, number)}`;
  const formula = render(value.expression, number),
    evaluated = numericValue(value);
  return evaluated === undefined
    ? formula
    : `${formula} = ${number(evaluated)}`;
}
export function value(input: unknown, binding?: unknown): Scalar {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) throw new Error('Value must be finite');
    return input;
  }
  if (isSymbolic(input)) return input;
  if (typeof input !== 'string' || !input.trim())
    throw new Error('Enter a number, a symbol, or a LaTeX expression');
  const text = input.trim();
  if (Number.isFinite(Number(text))) return Number(text);
  if (identifier.test(text) && !['pi', 'e', 'Infinity', 'NaN'].includes(text))
    return variable(text, binding);
  const source =
    text === 'pi' ? '\\pi' : text === 'e' ? '\\exponentialE' : text;
  const parsed = parseLatex(source);
  if (
    ['Equal', 'Less', 'Greater', 'LessEqual', 'GreaterEqual'].includes(
      parsed.operator,
    )
  )
    throw new Error(
      'Use Equation or LaTeX Equation for an equality or relation',
    );
  const result: SymbolicScalar = {
    kind: 'math-expression',
    expression: { type: 'latex', latex: normalizeLatex(source) },
  };
  validateMath(result);
  return result;
}
function latexNumber(n: number): string {
  return String(n).replace(/e([+-]?\d+)/i, '\\times 10^{$1}');
}
function symbolLatex(name: string): string {
  const greek = new Set([
    'alpha',
    'beta',
    'gamma',
    'delta',
    'epsilon',
    'theta',
    'lambda',
    'mu',
    'nu',
    'xi',
    'pi',
    'rho',
    'sigma',
    'tau',
    'phi',
    'chi',
    'psi',
    'omega',
    'Gamma',
    'Delta',
    'Theta',
    'Lambda',
    'Xi',
    'Pi',
    'Sigma',
    'Phi',
    'Psi',
    'Omega',
  ]);
  if (greek.has(name)) return `\\${name}`;
  const [base, ...suffix] = name.split('_');
  const text = base.length === 1 ? base : `\\mathrm{${base}}`;
  return suffix.length ? `${text}_{${suffix.join('\\_')}}` : text;
}
export function expressionLatex(e: Expression): string {
  if (e.type === 'latex') return e.latex;
  if (e.type === 'number') return latexNumber(e.value);
  if (e.type === 'symbol') return symbolLatex(e.name);
  if (e.type === 'function') {
    const a = expressionLatex(e.argument);
    if (e.name === 'sqrt') return `\\sqrt{${a}}`;
    if (e.name === 'square') return `\\left(${a}\\right)^2`;
    if (e.name === 'abs') return `\\left|${a}\\right|`;
    return `\\${e.name}\\left(${a}\\right)`;
  }
  const a = expressionLatex(e.left),
    b = expressionLatex(e.right);
  if (e.operator === '/') return `\\frac{${a}}{${b}}`;
  const wrap = (v: Expression, t: string) =>
    precedence(v) < precedence(e) || v.type === 'latex'
      ? `\\left(${t}\\right)`
      : t;
  if (e.operator === '^') {
    const base =
      (e.left.type === 'number' && e.left.value < 0) ||
      (e.left.type === 'binary' && e.left.operator === '^')
        ? `\\left(${a}\\right)`
        : wrap(e.left, a);
    return `{${base}}^{${b}}`;
  }
  const right =
    e.operator === '-' &&
    e.right.type === 'binary' &&
    ['+', '-'].includes(e.right.operator)
      ? `\\left(${b}\\right)`
      : wrap(e.right, b);
  return `${wrap(e.left, a)} ${e.operator === '*' ? '\\cdot' : e.operator === '%' ? '\\bmod' : e.operator} ${right}`;
}
export function toLatex(
  input: unknown,
  includeValue = true,
  precision = 12,
): string {
  const digits = Math.min(15, Math.max(1, Math.trunc(precision) || 12));
  if (isEquation(input))
    return `${expressionLatex(input.left)} = ${expressionLatex(input.right)}`;
  if (isSymbolic(input)) {
    const tex = expressionLatex(input.expression),
      n = includeValue ? numericValue(input) : undefined;
    return n === undefined
      ? tex
      : `${tex} = ${latexNumber(Number(n.toPrecision(digits)))}`;
  }
  if (typeof input === 'number') return latexNumber(input);
  if (Array.isArray(input))
    return `\\begin{bmatrix}${input.map((row) => (Array.isArray(row) ? row.map((n) => toLatex(n)).join('&') : toLatex(row))).join('\\\\')}\\end{bmatrix}`;
  return '';
}
function asLatex(input: unknown): string {
  return expressionLatex(expression(input));
}
function fromLatex(latex: string, bound: Record<string, number> = {}): Scalar {
  const result: SymbolicScalar = {
    kind: 'math-expression',
    expression: { type: 'latex', latex, bindings: bound },
  };
  validateMath(result);
  return result;
}
export function latexEquation(input: string): Equation {
  const parsed = parseLatex(input);
  if (
    parsed.operator !== 'Equal' ||
    !Array.isArray(parsed.json) ||
    parsed.json.length !== 3
  )
    throw new Error('Enter one equation using =');
  return equation(
    fromLatex(
      computeEngine().box((parsed.json as unknown[])[1] as never).latex,
    ),
    fromLatex(
      computeEngine().box((parsed.json as unknown[])[2] as never).latex,
    ),
  );
}
export function substitute(input: unknown, specification: string): Scalar {
  const assignments: Record<string, number> = {};
  for (const entry of specification
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    const match = entry.match(/^([\p{L}_][\p{L}\p{N}_]*)\s*=\s*(.+)$/u);
    if (!match) throw new Error('Use bindings such as A=2, B=3');
    const n = Number(match[2]);
    if (!Number.isFinite(n)) throw new Error('Bindings must be finite numbers');
    assignments[match[1]] = n;
  }
  const e = expression(input),
    existing = Object.fromEntries(bindings(e));
  return fromLatex(expressionLatex(e), { ...existing, ...assignments });
}
export function transform(
  input: unknown,
  operation: 'Simplify' | 'Expand' | 'Factor',
): Scalar {
  const ce = computeEngine(),
    e = expression(input),
    bound = Object.fromEntries(bindings(e));
  const result = ce.withTimeLimit(300, () =>
    ce.box([operation, parseLatex(expressionLatex(e))]).evaluate(),
  );
  return fromLatex(result.latex, bound);
}
export function derivative(input: unknown, symbol: string): Scalar {
  if (!identifier.test(symbol))
    throw new Error('Enter the differentiation variable');
  const ce = computeEngine(),
    e = expression(input);
  return fromLatex(
    ce.withTimeLimit(300, () =>
      ce.box(['D', parseLatex(expressionLatex(e)), symbol]).evaluate(),
    ).latex,
    Object.fromEntries(bindings(e)),
  );
}
export function integral(
  input: unknown,
  symbol: string,
  lower?: unknown,
  upper?: unknown,
): Scalar {
  if (!identifier.test(symbol))
    throw new Error('Enter the integration variable');
  const ce = computeEngine(),
    e = expression(input),
    f = parseLatex(expressionLatex(e));
  const expressionToIntegrate =
    lower === undefined
      ? ce.box(['Integrate', f, symbol])
      : parseLatex(
          `\\int_{${asLatex(lower)}}^{${asLatex(upper)}} ${expressionLatex(e)}\\,\\mathrm{d}${symbol}`,
        );
  return fromLatex(
    ce.withTimeLimit(350, () => expressionToIntegrate.evaluate()).latex,
    Object.fromEntries(bindings(e)),
  );
}
export function numeric(input: unknown): number {
  const n = numericValue(value(input));
  if (n === undefined)
    throw new Error('Assign all variables before numerical evaluation');
  return n;
}
export function call(name: string, ...args: unknown[]): Scalar {
  const ce = computeEngine(),
    expressions = args.map(expression),
    bound = Object.fromEntries(bindings(...expressions));
  const result = ce.withTimeLimit(200, () =>
    ce
      .box([name, ...expressions.map((e) => parseLatex(expressionLatex(e)))])
      .evaluate(),
  );
  if (args.every((a) => typeof a === 'number')) {
    const n = result.N();
    if (n.isNumber === true) {
      if (!Number.isFinite(n.re) || n.im !== 0)
        throw new Error('Function has no finite real result');
      return n.re;
    }
  }
  return fromLatex(result.latex, bound);
}
export function series(
  input: unknown,
  symbol: string,
  lower: unknown,
  upper: unknown,
  product = false,
): Scalar {
  if (!identifier.test(symbol)) throw new Error('Enter a summation variable');
  const lo = numeric(lower),
    hi = numeric(upper);
  if (
    !Number.isInteger(lo) ||
    !Number.isInteger(hi) ||
    hi < lo ||
    hi - lo > 1000
  )
    throw new Error('Use integer bounds with at most 1001 terms');
  const e = expression(input),
    ce = computeEngine();
  const tex = `\\${product ? 'prod' : 'sum'}_{${symbol}=${lo}}^{${hi}} \\left(${expressionLatex(e)}\\right)`;
  const result = ce.withTimeLimit(350, () => parseLatex(tex).evaluate());
  const bound = Object.fromEntries(bindings(e));
  delete bound[symbol];
  return fromLatex(result.latex, bound);
}
export const kernelMath = Object.assign(Object.create(Math) as Math, {
  collections,
  variable,
  value,
  operate,
  applyFunction,
  equation,
  numericValue,
  numeric,
  series,
  call,
  latexEquation,
  substitute,
  transform,
  derivative,
  integral,
  toLatex,
});
