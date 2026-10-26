import { readFileSync } from 'node:fs';
import { parseGraph } from '../src/utils/graphFile';
import { test, expect } from '@playwright/test';
import {
  variable,
  operate,
  applyFunction,
  equation,
  numericValue,
  isSymbolic,
} from '../src/utils/symbolicMath';
import { formatValue, connectionError } from '../src/utils/graphRules';
import { executeMathGraph } from '../src/utils/dagEngine';
import { DEFAULT_NODE_DEFINITIONS as definitions } from '../src/utils/defaultNodes';
import { MathNodeInstance, NodeConnection } from '../src/types';
const node = (
  id: string,
  type: string,
  values: Record<string, unknown> = {},
): MathNodeInstance => ({ id, type, title: id, x: 0, y: 0, values });
const wire = (
  fromNodeId: string,
  fromSocket: string,
  toNodeId: string,
  toSocket: string,
): NodeConnection => ({
  id: `${fromNodeId}-${toNodeId}-${toSocket}`,
  fromNodeId,
  fromSocket,
  toNodeId,
  toSocket,
});

test('variables produce symbolic arithmetic and optional values retain formula names', () => {
  const a = variable('A'),
    b = variable('B');
  expect(formatValue(operate('Add (+)', a, b))).toBe('A + B');
  const bound = operate('Add (+)', variable('A', 2), variable('B', 3));
  expect(formatValue(bound)).toBe('A + B = 5');
  expect(numericValue(bound)).toBe(5);
  expect(formatValue(variable('A', 0))).toBe('A = 0');
  expect(formatValue(operate('Multiply (*)', a, 1))).toBe('A');
  expect(formatValue(operate('Add (+)', a, 0))).toBe('A');
  expect(operate('Multiply (*)', a, 0)).toBe(0);
  expect(() => variable('A + B')).toThrow('variable name');
  expect(() => variable('Infinity', Infinity)).toThrow('finite');
});
test('formula formatting preserves precedence, subtraction and power associativity', () => {
  const a = variable('A'),
    b = variable('B'),
    c = variable('C');
  expect(
    formatValue(operate('Multiply (*)', operate('Add (+)', a, b), c)),
  ).toBe('(A + B) \u00d7 C');
  expect(
    formatValue(operate('Subtract (-)', a, operate('Subtract (-)', b, c))),
  ).toBe('A - (B - C)');
  expect(
    formatValue(operate('Divide (/)', a, operate('Multiply (*)', b, c))),
  ).toBe('A / (B \u00d7 C)');
  expect(formatValue(operate('Power (^)', operate('Power (^)', a, b), c))).toBe(
    '(A ^ B) ^ C',
  );
  expect(formatValue(operate('Power (^)', a, operate('Power (^)', b, c)))).toBe(
    'A ^ B ^ C',
  );
  expect(formatValue(operate('Power (^)', -2, a))).toBe('(-2) ^ A');
  expect(formatValue(applyFunction('sin(x)', operate('Add (+)', a, b)))).toBe(
    'sin(A + B)',
  );
});
test('bindings are consistent within expressions and domain errors are never simplified away', () => {
  expect(() => operate('Add (+)', variable('A', 2), variable('A', 3))).toThrow(
    'Conflicting values',
  );
  expect(formatValue(operate('Add (+)', variable('A'), variable('A', 3)))).toBe(
    'A + A = 6',
  );
  expect(() => operate('Divide (/)', variable('A'), 0)).toThrow(
    'Division by zero',
  );
  expect(() => operate('Divide (/)', variable('A'), variable('B', 0))).toThrow(
    'Division by zero',
  );
  expect(() => applyFunction('sqrt(x)', variable('A', -1))).toThrow(
    'non-negative',
  );
  expect(() => applyFunction('ln(x)', variable('A', 0))).toThrow('positive');
});
test('variable to operation to equation to inspector works through the real evaluator', () => {
  const nodes = [
    node('A', 'math.value', { value: 'A' }),
    node('B', 'math.value', { value: 'B' }),
    node('C', 'math.value', { value: 'C' }),
    node('sum', 'math.operations'),
    node('eq', 'math.equation'),
    node('view', 'math.output'),
  ];
  const connections = [
    wire('A', 'value', 'sum', 'a'),
    wire('B', 'value', 'sum', 'b'),
    wire('sum', 'result', 'eq', 'left'),
    wire('C', 'value', 'eq', 'right'),
    wire('eq', 'equation', 'view', 'input'),
  ];
  const result = executeMathGraph(nodes, connections, definitions);
  expect(Object.values(result.errors).every((error) => error === null)).toBe(
    true,
  );
  expect(
    formatValue(
      result.updatedNodes.find((n) => n.id === 'sum')?.computedOutputs?.result,
    ),
  ).toBe('A + B');
  expect(formatValue(result.updatedNodes.at(-1)?.computedOutputs?.output)).toBe(
    'A + B = C',
  );
  const bound = nodes.map((n) =>
    ['A', 'B'].includes(n.id)
      ? {
          ...n,
          values: {
            ...n.values,
            assigned: true,
            binding: n.id === 'A' ? 2 : 3,
          },
        }
      : n,
  );
  const evaluated = executeMathGraph(bound, connections, definitions);
  expect(
    formatValue(
      evaluated.updatedNodes.find((n) => n.id === 'sum')?.computedOutputs
        ?.result,
    ),
  ).toBe('A + B = 5');
  expect(
    formatValue(evaluated.updatedNodes.at(-1)?.computedOutputs?.output),
  ).toBe('A + B = C');
  expect(formatValue(equation(variable('A'), variable('B')))).toBe('A = B');
});
test('settings are not connectable ports, and equations cannot feed scalar arithmetic', () => {
  const nodes = [
    node('source', 'math.constant'),
    node('operation', 'math.operations'),
    node('equation', 'math.equation'),
  ];
  expect(
    connectionError(
      wire('source', 'value', 'operation', 'operation'),
      nodes,
      [],
      definitions,
    ),
  ).toContain('socket');
  expect(
    connectionError(
      wire('equation', 'equation', 'operation', 'a'),
      nodes,
      [],
      definitions,
    ),
  ).toContain('equation to scalar');
  const result = executeMathGraph(
    nodes,
    [wire('source', 'value', 'operation', 'operation')],
    definitions,
  );
  expect(result.errors.operation).toContain('socket');
  const damaged = {
    kind: 'math-expression',
    expression: {
      type: 'binary',
      operator: '+',
      left: { type: 'symbol', name: 'x', binding: 1 },
      right: { type: 'symbol', name: 'x', binding: 2 },
    },
  };
  expect(isSymbolic(damaged)).toBe(true);
  const def = {
    id: 'bad',
    name: 'bad',
    inputs: [],
    outputs: [{ name: 'result', type: 'scalar' as const }],
    code: `() => ({result: ${JSON.stringify(damaged)}})`,
  };
  expect(
    executeMathGraph([node('bad', 'bad')], [], [def]).errors.bad,
  ).toContain('Conflicting values');
});

test('the shipped symbolic example evaluates to A + B = C', () => {
  const graph = parseGraph(
    readFileSync('examples/symbolic_equation.mathnode', 'utf8'),
  );
  const result = executeMathGraph(
    graph.nodes!,
    graph.connections!,
    definitions,
  );
  expect(Object.values(result.errors).every((error) => error === null)).toBe(
    true,
  );
  expect(
    formatValue(
      result.updatedNodes.find((n) => n.id === 'inspector')?.computedOutputs
        ?.output,
    ),
  ).toBe('A + B = C');
});
