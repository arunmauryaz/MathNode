import { STANDARD_FOLDERS, STANDARD_NODE_DEFINITIONS } from './standardLibrary';
import { VALUE_DEFINITION } from './valueDefinition';
import {
  MathNodeFolder,
  NodeDefinition,
  MathNodeInstance,
  NodeConnection,
} from '../types';

export const DEFAULT_FOLDERS: MathNodeFolder[] = [
  { id: 'folder-my-nodes', name: 'My Nodes', parentId: null },
  {
    id: 'folder-basic-math',
    name: 'Basic Math',
    parentId: null,
  },
  {
    id: 'folder-linalg',
    name: 'Linear Algebra',
    parentId: null,
  },
  {
    id: 'folder-display',
    name: 'Display & Output',
    parentId: null,
  },
  ...STANDARD_FOLDERS,
];

export const DEFAULT_NODE_DEFINITIONS: NodeDefinition[] = [
  // 1. Value Node (Source node: ZERO inputs, 1 output)
  VALUE_DEFINITION,
  {
    id: 'math.equation',
    name: 'Equation',
    folderId: 'folder-basic-math',
    category: 'Basic Math',
    badge: 'EQUATION',
    icon: 'function',
    description:
      'Build an equation from a left and right side, such as A + B = C; represents equality without solving for an unknown',
    inputs: [
      {
        name: 'left',
        type: 'scalar',
        default: 0,
        widget: 'number',
        description: 'Left side of the equation',
      },
      {
        name: 'right',
        type: 'scalar',
        default: 0,
        widget: 'number',
        description: 'Right side of the equation',
      },
    ],
    outputs: [
      { name: 'equation', type: 'equation', description: 'Symbolic equation' },
    ],
    code: `(inputs, math) => ({ equation: math.equation(inputs.left, inputs.right) })`,
  },

  // 2. Math Operation Node (Binary arithmetic operator)
  {
    id: 'math.operations',
    name: 'Math Operation',
    folderId: 'folder-basic-math',
    category: 'Basic Math',
    badge: 'OPERATOR',
    icon: 'multiply',
    description:
      'Calculates arithmetic operation between two values: +, -, *, /, ^, %',
    inputs: [
      {
        name: 'a',
        type: 'scalar',
        default: 0,
        widget: 'number',
        description: 'Operand A',
      },
      {
        name: 'b',
        type: 'scalar',
        default: 0,
        widget: 'number',
        description: 'Operand B',
      },
      {
        name: 'operation',
        connectable: false,
        type: 'string',
        default: 'Add (+)',
        widget: 'dropdown',
        options: [
          'Add (+)',
          'Subtract (-)',
          'Multiply (*)',
          'Divide (/)',
          'Power (^)',
          'Modulo (%)',
        ],
        description: 'Arithmetic operator',
      },
    ],
    outputs: [
      {
        name: 'result',
        type: 'scalar',
        description: 'Computed arithmetic result',
      },
    ],
    code: `(inputs, math) => ({ result: math.operate(String(inputs.operation || 'Add (+)'), inputs.a ?? 0, inputs.b ?? 0) })`,
  },

  // 3. View Result Node (Display / Sink node: 1 input, ZERO outputs)
  {
    id: 'math.output',
    name: 'View Result',
    folderId: 'folder-display',
    category: 'Display & Output',
    badge: 'RESULT',
    icon: 'output',
    description:
      'Digital instrument display that inspects and displays live results',
    inputs: [
      {
        name: 'input',
        type: 'any',
        default: 0,
        description: 'Incoming data to display',
      },
    ],
    outputs: [], // Terminal sink node - no output socket needed
    code: `(inputs) => {
  return { output: inputs.input ?? 0 };
}`,
  },

  // 4. Math Function Node (Unary operations: sin, cos, tan, sqrt, etc.)
  {
    id: 'math.function',
    name: 'Math Function',
    folderId: 'folder-basic-math',
    category: 'Basic Math',
    badge: 'FUNCTION',
    icon: 'function',
    description:
      'Calculates sin, cos, tan, sqrt, abs, ln, exp of an input value',
    inputs: [
      {
        name: 'x',
        type: 'scalar',
        default: 0,
        widget: 'number',
        description: 'Input value x',
      },
      {
        name: 'func',
        connectable: false,
        type: 'string',
        default: 'sin(x)',
        widget: 'dropdown',
        options: [
          'sin(x)',
          'cos(x)',
          'tan(x)',
          'sqrt(x)',
          'abs(x)',
          'ln(x)',
          'exp(x)',
          'x^2',
        ],
        description: 'Mathematical function',
      },
    ],
    outputs: [
      {
        name: 'result',
        type: 'scalar',
        description: 'Computed function result',
      },
    ],
    code: `(inputs, math) => ({ result: math.applyFunction(String(inputs.func || 'sin(x)'), inputs.x ?? 0) })`,
  },

  // 5. Mathematical Constant Node (pi, e, phi, sqrt2)
  {
    id: 'math.constant',
    name: 'Constant',
    folderId: 'folder-basic-math',
    category: 'Basic Math',
    badge: 'CONST',
    icon: 'delta',
    description: 'Provides exact mathematical constants: π, e, φ, √2',
    inputs: [
      {
        name: 'constant',
        connectable: false,
        type: 'string',
        default: 'π (pi)',
        widget: 'dropdown',
        options: ['π (pi)', 'e (Euler)', 'φ (Golden ratio)', '√2 (Pythagoras)'],
        description: 'Mathematical constant',
      },
    ],
    outputs: [
      {
        name: 'value',
        type: 'scalar',
        description: 'Constant numeric value',
      },
    ],
    code: `(inputs) => {
  const c = String(inputs.constant || 'π (pi)');
  if (c.includes('π')) return { value: Math.PI };
  if (c === 'e (Euler)') return { value: Math.E };
  if (c.includes('φ')) return { value: (1 + Math.sqrt(5)) / 2 };
  if (c.includes('√2')) return { value: Math.SQRT2 };
  return { value: Math.PI };
}`,
  },

  // 6. Matrix Multiply Node
  {
    id: 'math.matrix_mul',
    name: 'Matrix Multiply',
    folderId: 'folder-linalg',
    category: 'Linear Algebra',
    badge: 'LINALG',
    icon: 'matrix',
    description: 'Multiplies two 2x2 matrices A and B (C = A × B)',
    inputs: [
      {
        name: 'A',
        type: 'matrix',
        default: [
          [1, 2],
          [3, 4],
        ],
        widget: 'matrix2x2',
        description: 'Matrix A',
      },
      {
        name: 'B',
        type: 'matrix',
        default: [
          [2, 0],
          [1, 2],
        ],
        widget: 'matrix2x2',
        description: 'Matrix B',
      },
    ],
    outputs: [
      {
        name: 'C',
        type: 'matrix',
        description: 'Result Matrix C = A × B',
      },
    ],
    code: `(inputs) => {
  const A = inputs.A || [[1, 0], [0, 1]];
  const B = inputs.B || [[1, 0], [0, 1]];
  if (![A, B].every(M => Array.isArray(M) && M.length === 2 && M.every(r => Array.isArray(r) && r.length === 2 && r.every(Number.isFinite)))) throw new Error('Expected two 2×2 matrices');
  const C = [
    [A[0][0]*B[0][0] + A[0][1]*B[1][0], A[0][0]*B[0][1] + A[0][1]*B[1][1]],
    [A[1][0]*B[0][0] + A[1][1]*B[1][0], A[1][0]*B[0][1] + A[1][1]*B[1][1]]
  ];
  return { C };
}`,
  },
  ...STANDARD_NODE_DEFINITIONS,
];

// Pre-configured live working graph: 2 Value nodes -> Math Operation (+) -> View Result
export const INITIAL_DEMO_NODES: MathNodeInstance[] = [
  {
    id: 'node-demo-val1',
    definitionId: 'math.value',
    type: 'math.value',
    title: 'Value A',
    x: -440,
    y: -160,
    width: 260,
    height: 186,
    values: { value: 25 },
    computedOutputs: { value: 25 },
  },
  {
    id: 'node-demo-val2',
    definitionId: 'math.value',
    type: 'math.value',
    title: 'Value B',
    x: -440,
    y: 100,
    width: 260,
    height: 186,
    values: { value: 17 },
    computedOutputs: { value: 17 },
  },
  {
    id: 'node-demo-op',
    definitionId: 'math.operations',
    type: 'math.operations',
    title: 'Math Operation',
    x: -80,
    y: -100,
    width: 250,
    height: 238,
    values: { a: 25, b: 17, operation: 'Add (+)' },
    computedOutputs: { result: 42 },
  },
  {
    id: 'node-demo-output',
    definitionId: 'math.output',
    type: 'math.output',
    title: 'View Result',
    x: 280,
    y: 20,
    width: 240,
    height: 168,
    values: { input: 42 },
    computedOutputs: { output: 42 },
  },
];

export const INITIAL_DEMO_CONNECTIONS: NodeConnection[] = [
  {
    id: 'conn-1',
    fromNodeId: 'node-demo-val1',
    fromSocket: 'value',
    toNodeId: 'node-demo-op',
    toSocket: 'a',
    color: '#60A5FA',
  },
  {
    id: 'conn-2',
    fromNodeId: 'node-demo-val2',
    fromSocket: 'value',
    toNodeId: 'node-demo-op',
    toSocket: 'b',
    color: '#60A5FA',
  },
  {
    id: 'conn-3',
    fromNodeId: 'node-demo-op',
    fromSocket: 'result',
    toNodeId: 'node-demo-output',
    toSocket: 'input',
    color: '#60A5FA',
  },
];
