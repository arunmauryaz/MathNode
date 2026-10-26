import { NodeDefinition, NodeSocketDef, MathNodeFolder } from '../types';
export interface NodeExample {
  values: Record<string, unknown>;
  expected: unknown;
}
export const STANDARD_EXAMPLES: Record<string, NodeExample> = {};
export const STANDARD_FOLDERS: MathNodeFolder[] = [
  'Arithmetic',
  'Trigonometry',
  'Algebra & Calculus',
  'Statistics',
  'Vectors & Matrices',
  'Logic',
].map((name, i) => ({ id: `standard-${i}`, name, parentId: null }));
const defs: NodeDefinition[] = [];
const scalar = (
  name: string,
  defaultValue: number | string = 0,
): NodeSocketDef => ({
  name,
  type: 'scalar',
  default: defaultValue,
  widget: 'number',
});
const text = (name: string, defaultValue: string): NodeSocketDef => ({
  name,
  type: 'string',
  default: defaultValue,
  widget: 'text',
  connectable: false,
});
const vec = (
  name: string,
  defaultValue: number[] = [1, 2, 3],
): NodeSocketDef => ({ name, type: 'vector', default: defaultValue });
const mat = (
  name: string,
  defaultValue: number[][] = [
    [1, 2],
    [3, 4],
  ],
): NodeSocketDef => ({
  name,
  type: 'matrix',
  default: defaultValue,
  widget: 'matrix2x2',
});
function add(
  id: string,
  name: string,
  category: number,
  inputs: NodeSocketDef[],
  body: string,
  expected: unknown,
  type: NodeSocketDef['type'] = 'scalar',
  description?: string,
) {
  const fullId = `standard.${id}`;
  defs.push({
    id: fullId,
    name,
    folderId: `standard-${category}`,
    category: STANDARD_FOLDERS[category].name,
    badge: category === 2 ? 'FORMULA' : 'MATH',
    icon: 'function',
    description:
      description ||
      `${name}. ${category === 2 ? 'Accepts symbolic formulas and LaTeX.' : 'Angles use radians; numeric collection operations require assigned values.'}`,
    inputs,
    outputs: [{ name: 'result', type }],
    code: `(inputs, math) => ({ result: ${body} })`,
  });
  STANDARD_EXAMPLES[fullId] = {
    values: Object.fromEntries(inputs.map((s) => [s.name, s.default])),
    expected,
  };
}
for (const [id, name, op, expected] of [
  ['add', 'Add', '+', 5],
  ['subtract', 'Subtract', '-', -1],
  ['multiply', 'Multiply', '*', 6],
  ['divide', 'Divide', '/', 2 / 3],
  ['power', 'Power', '^', 8],
  ['modulo', 'Modulo', '%', 2],
] as const)
  add(
    id,
    name,
    0,
    [scalar('a', 2), scalar('b', 3)],
    `math.operate('${op}',inputs.a,inputs.b)`,
    expected,
  );
for (const [id, name, operator, arg, expected] of [
  ['sqrt', 'Square Root', 'Sqrt', 9, 3],
  ['square', 'Square', 'Square', 3, 9],
  ['cube', 'Cube', 'Cube', 3, 27],
  ['abs', 'Absolute Value', 'Abs', -4, 4],
  ['negate', 'Negate', 'Negate', 4, -4],
  ['floor', 'Floor', 'Floor', 2.8, 2],
  ['ceil', 'Ceiling', 'Ceil', 2.2, 3],
  ['round', 'Round', 'Round', 2.6, 3],
  ['sign', 'Sign', 'Sign', -5, -1],
  ['sin', 'Sine', 'Sin', 0, 0],
  ['cos', 'Cosine', 'Cos', 0, 1],
  ['tan', 'Tangent', 'Tan', 0, 0],
  ['asin', 'Arc Sine', 'Arcsin', 0, 0],
  ['acos', 'Arc Cosine', 'Arccos', 1, 0],
  ['atan', 'Arc Tangent', 'Arctan', 0, 0],
  ['sinh', 'Hyperbolic Sine', 'Sinh', 0, 0],
  ['cosh', 'Hyperbolic Cosine', 'Cosh', 0, 1],
  ['tanh', 'Hyperbolic Tangent', 'Tanh', 0, 0],
  ['asinh', 'Inverse Hyperbolic Sine', 'Arsinh', 0, 0],
  ['acosh', 'Inverse Hyperbolic Cosine', 'Arcosh', 1, 0],
  ['atanh', 'Inverse Hyperbolic Tangent', 'Artanh', 0, 0],
  ['exp', 'Exponential', 'Exp', 0, 1],
  ['ln', 'Natural Logarithm', 'Ln', 1, 0],
] as const)
  add(
    id,
    name,
    [
      'sin',
      'cos',
      'tan',
      'asin',
      'acos',
      'atan',
      'sinh',
      'cosh',
      'tanh',
      'asinh',
      'acosh',
      'atanh',
    ].includes(id)
      ? 1
      : 0,
    [scalar('x', arg)],
    operator === 'Square'
      ? "math.operate('^',inputs.x,2)"
      : operator === 'Cube'
        ? "math.operate('^',inputs.x,3)"
        : `math.call('${operator}',inputs.x)`,
    expected,
  );
add(
  'root',
  'Nth Root',
  0,
  [scalar('x', 27), scalar('degree', 3)],
  "(() => { if(math.numericValue(inputs.degree) === 0) throw Error('Root degree cannot be zero'); return math.call('Root',inputs.x,inputs.degree); })()",
  3,
);
add(
  'reciprocal',
  'Reciprocal',
  0,
  [scalar('x', 4)],
  "math.operate('/',1,inputs.x)",
  0.25,
);
add(
  'log-base',
  'Logarithm Base',
  0,
  [scalar('x', 8), scalar('base', 2)],
  "math.operate('/',math.call('Ln',inputs.x),math.call('Ln',inputs.base))",
  3,
);
for (const [id, name, body, arg, expected] of [
  ['log10', 'Log Base 10', 'math.log10', 100, 2],
  ['log2', 'Log Base 2', 'math.log2', 8, 3],
  ['trunc', 'Truncate', 'math.trunc', 2.9, 2],
  ['degrees', 'Radians to Degrees', 'x=>x*180/math.PI', Math.PI, 180],
  ['radians', 'Degrees to Radians', 'x=>x*math.PI/180', 180, Math.PI],
] as const)
  add(
    id,
    name,
    0,
    [scalar('x', arg)],
    `(${body})(math.numeric(inputs.x))`,
    expected,
  );
add(
  'min',
  'Minimum',
  0,
  [scalar('a', 2), scalar('b', 3)],
  "math.call('Min',inputs.a,inputs.b)",
  2,
);
add(
  'max',
  'Maximum',
  0,
  [scalar('a', 2), scalar('b', 3)],
  "math.call('Max',inputs.a,inputs.b)",
  3,
);
add(
  'hypot',
  'Hypotenuse',
  0,
  [scalar('a', 3), scalar('b', 4)],
  "math.call('Sqrt',math.operate('+',math.operate('^',inputs.a,2),math.operate('^',inputs.b,2)))",
  5,
);
add(
  'atan2',
  'Angle from XY',
  1,
  [scalar('y', 0), scalar('x', 1)],
  'math.atan2(math.numeric(inputs.y),math.numeric(inputs.x))',
  0,
);
add(
  'clamp',
  'Clamp',
  0,
  [scalar('x', 5), scalar('min', 0), scalar('max', 1)],
  "(()=>{const lo=math.numeric(inputs.min),hi=math.numeric(inputs.max);if(lo>hi)throw Error('Minimum exceeds maximum');return math.min(hi,math.max(lo,math.numeric(inputs.x)));})()",
  1,
);
add(
  'lerp',
  'Linear Interpolation',
  0,
  [scalar('a', 0), scalar('b', 10), scalar('t', 0.25)],
  "math.operate('+',inputs.a,math.operate('*',math.operate('-',inputs.b,inputs.a),inputs.t))",
  2.5,
);
add(
  'factorial',
  'Factorial',
  0,
  [scalar('n', 5)],
  'math.collections.factorial(math.numeric(inputs.n))',
  120,
);
for (const permutation of [false, true])
  add(
    permutation ? 'permutations' : 'combinations',
    permutation ? 'Permutations nPr' : 'Combinations nCr',
    0,
    [scalar('n', 5), scalar('k', 2)],
    `math.collections.combinatorics(math.numeric(inputs.n),math.numeric(inputs.k),${permutation})`,
    permutation ? 20 : 10,
  );
add(
  'gcd',
  'Greatest Common Divisor',
  0,
  [scalar('a', 12), scalar('b', 18)],
  'math.collections.gcd(math.numeric(inputs.a),math.numeric(inputs.b))',
  6,
);
add(
  'lcm',
  'Least Common Multiple',
  0,
  [scalar('a', 12), scalar('b', 18)],
  '(()=>{const a=math.numeric(inputs.a),b=math.numeric(inputs.b),d=math.collections.gcd(a,b);return d===0?0:math.abs((a/d)*b);})()',
  36,
);
add(
  'formula',
  'LaTeX Formula',
  2,
  [text('formula', 'A^2+B^2+2AB')],
  'math.value(inputs.formula)',
  undefined,
  'scalar',
  'Enter a scalar LaTeX expression. Use Substitute (A=2, B=3) to supply values; display and share the original formula.',
);
add(
  'latex-equation',
  'LaTeX Equation',
  2,
  [text('equation', 'y=x^2')],
  'math.latexEquation(inputs.equation)',
  undefined,
  'equation',
  'Typeset an equality with LaTeX. Represents a relation; does not automatically solve it.',
);
for (const op of ['Simplify', 'Expand', 'Factor'])
  add(
    op.toLowerCase(),
    op,
    2,
    [scalar('expression', '(A+B)^2')],
    `math.transform(inputs.expression,'${op}')`,
    undefined,
  );
add(
  'substitute',
  'Substitute',
  2,
  [scalar('expression', 'A^2+B^2+2AB'), text('bindings', 'A=2, B=3')],
  'math.substitute(inputs.expression,inputs.bindings)',
  25,
);
add(
  'numeric',
  'Evaluate Numerically',
  2,
  [scalar('expression', 3)],
  'math.numeric(inputs.expression)',
  3,
);
add(
  'derivative',
  'Derivative',
  2,
  [scalar('expression', 'x^3'), text('variable', 'x')],
  'math.derivative(inputs.expression,inputs.variable)',
  undefined,
);
add(
  'integral',
  'Indefinite Integral',
  2,
  [scalar('expression', 'x^2'), text('variable', 'x')],
  'math.integral(inputs.expression,inputs.variable)',
  undefined,
  'scalar',
  'Symbolic antiderivative where supported; add a constant of integration when writing a general solution.',
);
add(
  'definite-integral',
  'Definite Integral',
  2,
  [
    scalar('expression', 'x^2'),
    text('variable', 'x'),
    scalar('lower', 0),
    scalar('upper', 1),
  ],
  'math.integral(inputs.expression,inputs.variable,inputs.lower,inputs.upper)',
  1 / 3,
);
for (const product of [false, true])
  add(
    product ? 'product' : 'sum',
    product ? 'Finite Product' : 'Finite Sum',
    2,
    [
      scalar('expression', 'n'),
      text('variable', 'n'),
      scalar('lower', 1),
      scalar('upper', 5),
    ],
    `math.series(inputs.expression,inputs.variable,inputs.lower,inputs.upper,${product})`,
    product ? 120 : 15,
  );
add(
  'dataset',
  'Numeric Dataset',
  3,
  [text('numbers', '1, 2, 3, 4')],
  'math.collections.dataset(inputs.numbers)',
  [1, 2, 3, 4],
  'vector',
);
for (const [op, name, expected] of [
  ['sum', 'Dataset Sum', 10],
  ['count', 'Count', 4],
  ['mean', 'Mean', 2.5],
  ['median', 'Median', 2.5],
  ['min', 'Dataset Minimum', 1],
  ['max', 'Dataset Maximum', 4],
  ['variance', 'Population Variance', 1.25],
  ['stddev', 'Population Standard Deviation', Math.sqrt(1.25)],
] as const)
  add(
    'stats-' + op,
    name,
    3,
    [vec('data', [1, 2, 3, 4])],
    `math.collections.stats(inputs.data,'${op}')`,
    expected,
  );
add(
  'vector2',
  'Vector 2D',
  4,
  [scalar('x', 1), scalar('y', 2)],
  '[math.numeric(inputs.x),math.numeric(inputs.y)]',
  [1, 2],
  'vector',
);
add(
  'vector3',
  'Vector 3D',
  4,
  [scalar('x', 1), scalar('y', 2), scalar('z', 3)],
  '[math.numeric(inputs.x),math.numeric(inputs.y),math.numeric(inputs.z)]',
  [1, 2, 3],
  'vector',
);
for (const [op, name, expected, type] of [
  ['add', 'Vector Add', [2, 4, 6], 'vector'],
  ['subtract', 'Vector Subtract', [0, 0, 0], 'vector'],
  ['dot', 'Dot Product', 14, 'scalar'],
  ['cross', 'Cross Product', [0, 0, 0], 'vector'],
  ['distance', 'Vector Distance', 0, 'scalar'],
] as const)
  add(
    'vector-' + op,
    name,
    4,
    [vec('a'), vec('b')],
    `math.collections.vectorOp(inputs.a,inputs.b,'${op}')`,
    expected,
    type,
  );
add(
  'norm',
  'Vector Length',
  4,
  [vec('v', [3, 4])],
  'math.collections.norm(inputs.v)',
  5,
);
add(
  'normalize',
  'Normalize Vector',
  4,
  [vec('v', [3, 4])],
  'math.collections.normalize(inputs.v)',
  [0.6, 0.8],
  'vector',
);
add(
  'vector-scale',
  'Scale Vector',
  4,
  [vec('v'), scalar('scale', 2)],
  'math.collections.scale(inputs.v,math.numeric(inputs.scale))',
  [2, 4, 6],
  'vector',
);
add(
  'transpose',
  'Matrix Transpose',
  4,
  [mat('matrix')],
  'math.collections.transpose(inputs.matrix)',
  [
    [1, 3],
    [2, 4],
  ],
  'matrix',
);
add(
  'determinant',
  'Matrix Determinant',
  4,
  [mat('matrix')],
  'math.collections.determinant(inputs.matrix)',
  -2,
);
add(
  'inverse',
  'Matrix Inverse',
  4,
  [mat('matrix')],
  'math.collections.inverse(inputs.matrix)',
  [
    [-2, 1],
    [1.5, -0.5],
  ],
  'matrix',
);
add(
  'matrix-add',
  'Matrix Add',
  4,
  [mat('a'), mat('b')],
  'math.collections.matrixAdd(inputs.a,inputs.b)',
  [
    [2, 4],
    [6, 8],
  ],
  'matrix',
);
add(
  'matrix-multiply',
  'General Matrix Product',
  4,
  [mat('a'), mat('b')],
  'math.collections.matrixMultiply(inputs.a,inputs.b)',
  [
    [7, 10],
    [15, 22],
  ],
  'matrix',
);
for (const [id, name, op, expected] of [
  ['less', 'Less Than', '<', true],
  ['greater', 'Greater Than', '>', false],
  ['equal', 'Numerically Equal', '===', false],
  ['less-equal', 'Less or Equal', '<=', true],
  ['greater-equal', 'Greater or Equal', '>=', false],
] as const)
  add(
    id,
    name,
    5,
    [scalar('a', 2), scalar('b', 3)],
    `math.numeric(inputs.a) ${op} math.numeric(inputs.b)`,
    expected,
    'bool',
  );
const bool = (name: string, defaultValue = true): NodeSocketDef => ({
  name,
  type: 'bool',
  default: defaultValue,
  widget: 'toggle',
});
add(
  'and',
  'Boolean AND',
  5,
  [bool('a'), bool('b', false)],
  'inputs.a && inputs.b',
  false,
  'bool',
);
add(
  'or',
  'Boolean OR',
  5,
  [bool('a'), bool('b', false)],
  'inputs.a || inputs.b',
  true,
  'bool',
);
add('not', 'Boolean NOT', 5, [bool('value')], '!inputs.value', false, 'bool');
add(
  'select',
  'Select Value',
  5,
  [bool('condition'), scalar('whenTrue', 1), scalar('whenFalse', 0)],
  'inputs.condition ? inputs.whenTrue : inputs.whenFalse',
  1,
);
export const STANDARD_NODE_DEFINITIONS = defs;
