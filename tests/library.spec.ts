import { test, expect } from '@playwright/test';
import {
  STANDARD_NODE_DEFINITIONS,
  STANDARD_EXAMPLES,
} from '../src/utils/standardLibrary';
import { executeMathGraph } from '../src/utils/dagEngine';
import {
  operate,
  variable,
  numericValue,
  value,
  substitute,
  numeric,
  toLatex,
  derivative,
  integral,
  transform,
  latexEquation,
} from '../src/utils/symbolicMath';
import { parseMNode } from '../src/utils/nodeParser';
import { parseGraph } from '../src/utils/graphFile';

test('every standard node validates and executes its documented example', () => {
  for (const definition of STANDARD_NODE_DEFINITIONS) {
    expect(
      parseMNode(JSON.stringify(definition)),
      definition.id,
    ).not.toBeNull();
    const fixture = STANDARD_EXAMPLES[definition.id];
    const result = executeMathGraph(
      [
        {
          id: 'test',
          type: definition.id,
          title: definition.name,
          x: 0,
          y: 0,
          values: fixture.values,
        },
      ],
      [],
      [definition],
    ).updatedNodes[0];
    expect(result.error, definition.id).toBeFalsy();
    if (fixture.expected !== undefined) {
      const output = result.computedOutputs?.result;
      const actual =
        typeof fixture.expected === 'number' ? numericValue(output) : output;
      if (typeof fixture.expected === 'number')
        expect(actual, definition.id).toBeCloseTo(fixture.expected, 9);
      else if (definition.id === 'standard.inverse') {
        const actual = output as number[][],
          expected = fixture.expected as number[][];
        for (let r = 0; r < 2; r++)
          for (let c = 0; c < 2; c++)
            expect(actual[r][c]).toBeCloseTo(expected[r][c], 10);
      } else expect(actual, definition.id).toEqual(fixture.expected);
    }
  }
});
test('Value accepts symbols and LaTeX, binds shared formulas, and rejects invalid real expressions', () => {
  expect(toLatex(value('A'))).toBe('A');
  expect(numeric(substitute(value('A^2+B^2+2AB'), 'A=2, B=3'))).toBe(25);
  expect(numeric(value('\\frac{1}{2}+\\sqrt{9}'))).toBe(3.5);
  expect(numeric(value('sqrt(9)'))).toBe(3);
  expect(() => value('\\frac{')).toThrow('Invalid');
  expect(() => numeric(value('\\frac{1}{0}'))).toThrow();
  expect(() => numeric(value('\\sqrt{-1}'))).toThrow();
  expect(toLatex(latexEquation('A^2+B^2=C^2'))).toContain('=');
});
test('algebra and calculus operate on symbolic sources and later bindings', () => {
  expect(
    numeric(substitute(transform(value('(A+B)^2'), 'Expand'), 'A=2,B=3')),
  ).toBe(25);
  expect(
    numeric(substitute(transform(value('x^2+2x+1'), 'Factor'), 'x=3')),
  ).toBe(16);
  expect(numeric(substitute(derivative(value('x^3'), 'x'), 'x=2'))).toBe(12);
  expect(numeric(substitute(integral(value('x^2'), 'x'), 'x=3'))).toBe(9);
  expect(numeric(integral(value('x^2'), 'x', 0, 1))).toBeCloseTo(1 / 3);
});
test('legacy Variable nodes migrate to unified Value without losing names or bindings', () => {
  const graph = parseGraph(
    JSON.stringify({
      nodes: [
        {
          id: 'a',
          type: 'math.variable',
          title: 'A',
          x: 0,
          y: 0,
          values: { name: 'A', assigned: true, value: 2 },
        },
      ],
      connections: [],
    }),
  );
  expect(graph.nodes![0].type).toBe('math.value');
  expect(graph.nodes![0].values).toEqual({
    value: 'A',
    assigned: true,
    binding: 2,
  });
});

test('LaTeX transforms retain negative power bases and numeric domains reject invalid roots', () => {
  const powered = operate('^', -2, variable('n'));
  expect(numeric(substitute(powered, 'n=2'))).toBe(4);
  expect(toLatex(powered)).toContain('\\left(-2\\right)');
  const root = STANDARD_NODE_DEFINITIONS.find((d) => d.id === 'standard.root')!;
  const result = executeMathGraph(
    [
      {
        id: 'bad',
        type: root.id,
        title: 'Root',
        x: 0,
        y: 0,
        values: { x: 9, degree: 0 },
      },
    ],
    [],
    [root],
  ).updatedNodes[0];
  expect(result.error).toContain('degree cannot be zero');
});
