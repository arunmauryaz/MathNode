/** Numeric collection operations shared by portable node kernels. */
const finite = (n: number) => {
  if (!Number.isFinite(n)) throw new Error('Result must be finite');
  return n;
};
function vector(v: unknown): number[] {
  if (
    !Array.isArray(v) ||
    !v.length ||
    v.length > 10000 ||
    !v.every((n) => typeof n === 'number' && Number.isFinite(n))
  )
    throw new Error(
      'Expected a non-empty finite numeric vector (at most 10000 items)',
    );
  return v;
}
function pair(a: unknown, b: unknown): [number[], number[]] {
  const x = vector(a),
    y = vector(b);
  if (x.length !== y.length) throw new Error('Vector dimensions must match');
  return [x, y];
}
function matrix(v: unknown): number[][] {
  if (!Array.isArray(v) || !v.length || v.length > 32)
    throw new Error('Expected a matrix with at most 32 rows');
  const rows = v.map(vector);
  if (rows[0].length > 32 || rows.some((r) => r.length !== rows[0].length))
    throw new Error('Expected a rectangular matrix with at most 32 columns');
  return rows;
}
function integer(n: number, min = 0, max = 170): number {
  if (!Number.isInteger(n) || n < min || n > max)
    throw new Error(`Expected an integer from ${min} to ${max}`);
  return n;
}
export const collections = {
  dataset(text: string) {
    if (!text.trim()) throw new Error('Enter one or more numeric values');
    return vector(
      text
        .trim()
        .split(/[\s,;]+/)
        .map(Number),
    );
  },
  stats(v: unknown, operation: string) {
    const a = vector(v),
      sum = a.reduce((s, n) => s + n, 0),
      mean = sum / a.length;
    switch (operation) {
      case 'count':
        return a.length;
      case 'sum':
        return finite(sum);
      case 'mean':
        return finite(mean);
      case 'min':
        return Math.min(...a);
      case 'max':
        return Math.max(...a);
      case 'median': {
        const b = [...a].sort((x, y) => x - y),
          m = Math.floor(b.length / 2);
        return (b[m] + b[Math.ceil(b.length / 2) - 1]) / 2;
      }
      case 'variance':
        return finite(a.reduce((s, n) => s + (n - mean) ** 2, 0) / a.length);
      case 'stddev':
        return finite(
          Math.sqrt(a.reduce((s, n) => s + (n - mean) ** 2, 0) / a.length),
        );
      default:
        throw new Error('Unknown statistic');
    }
  },
  vector(v: unknown) {
    return vector(v);
  },
  vectorOp(a: unknown, b: unknown, op: string) {
    const [x, y] = pair(a, b);
    if (op === 'dot') return finite(x.reduce((s, n, i) => s + n * y[i], 0));
    if (op === 'distance')
      return finite(Math.hypot(...x.map((n, i) => n - y[i])));
    if (op === 'cross') {
      if (x.length !== 3) throw new Error('Cross product needs 3D vectors');
      return [
        x[1] * y[2] - x[2] * y[1],
        x[2] * y[0] - x[0] * y[2],
        x[0] * y[1] - x[1] * y[0],
      ].map(finite);
    }
    return x.map((n, i) => finite(op === 'add' ? n + y[i] : n - y[i]));
  },
  norm(v: unknown) {
    return finite(Math.hypot(...vector(v)));
  },
  scale(v: unknown, k: number) {
    return vector(v).map((n) => finite(n * k));
  },
  normalize(v: unknown) {
    const a = vector(v),
      n = Math.hypot(...a);
    if (n === 0) throw new Error('Cannot normalize a zero vector');
    return a.map((x) => x / n);
  },
  transpose(v: unknown) {
    const a = matrix(v);
    return a[0].map((_, i) => a.map((r) => r[i]));
  },
  matrixMultiply(x: unknown, y: unknown) {
    const a = matrix(x),
      b = matrix(y);
    if (a[0].length !== b.length)
      throw new Error('Matrix inner dimensions must match');
    return a.map((r) =>
      b[0].map((_, j) => finite(r.reduce((s, n, k) => s + n * b[k][j], 0))),
    );
  },
  matrixAdd(x: unknown, y: unknown) {
    const a = matrix(x),
      b = matrix(y);
    if (a.length !== b.length || a[0].length !== b[0].length)
      throw new Error('Matrix dimensions must match');
    return a.map((r, i) => r.map((n, j) => finite(n + b[i][j])));
  },
  determinant(v: unknown) {
    const a = matrix(v).map((r) => [...r]),
      n = a.length;
    if (a[0].length !== n)
      throw new Error('Determinant requires a square matrix');
    let d = 1;
    for (let i = 0; i < n; i++) {
      let p = i;
      for (let j = i + 1; j < n; j++)
        if (Math.abs(a[j][i]) > Math.abs(a[p][i])) p = j;
      if (a[p][i] === 0) return 0;
      if (p !== i) {
        [a[i], a[p]] = [a[p], a[i]];
        d = -d;
      }
      d *= a[i][i];
      for (let j = i + 1; j < n; j++) {
        const k = a[j][i] / a[i][i];
        for (let c = i + 1; c < n; c++) a[j][c] -= k * a[i][c];
      }
    }
    return finite(d);
  },
  inverse(v: unknown) {
    const a = matrix(v).map((r, i) => [
        ...r,
        ...r.map((_, j) => (i === j ? 1 : 0)),
      ]),
      n = a.length;
    if (a[0].length !== 2 * n)
      throw new Error('Inverse requires a square matrix');
    for (let i = 0; i < n; i++) {
      let p = i;
      for (let j = i + 1; j < n; j++)
        if (Math.abs(a[j][i]) > Math.abs(a[p][i])) p = j;
      if (a[p][i] === 0) throw new Error('Matrix is singular');
      [a[i], a[p]] = [a[p], a[i]];
      const pivot = a[i][i];
      a[i] = a[i].map((x) => x / pivot);
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const k = a[j][i];
        a[j] = a[j].map((x, c) => x - k * a[i][c]);
      }
    }
    return a.map((r) => r.slice(n).map(finite));
  },
  factorial(n: number) {
    integer(n);
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return finite(r);
  },
  combinatorics(n: number, k: number, permutation = false) {
    integer(n, 0, 170);
    integer(k, 0, n);
    let r = 1;
    for (let i = 1; i <= k; i++) r = (r * (n - i + 1)) / (permutation ? 1 : i);
    return finite(r);
  },
  gcd(a: number, b: number) {
    integer(Math.abs(a), 0, Number.MAX_SAFE_INTEGER);
    integer(Math.abs(b), 0, Number.MAX_SAFE_INTEGER);
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) [a, b] = [b, a % b];
    return a;
  },
};
