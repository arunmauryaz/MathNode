import { unpackComposite } from '../src/utils/unpackComposite';
import { test, expect } from '@playwright/test';
import {
  DEFAULT_NODE_DEFINITIONS as definitions,
  INITIAL_DEMO_NODES as demo,
  INITIAL_DEMO_CONNECTIONS as connections,
} from '../src/utils/defaultNodes';
import {
  createCompositeDefinition,
  replaceSelectionWithComposite,
  exportMNode,
} from '../src/utils/compositeNodes';
import { executeMathGraph } from '../src/utils/dagEngine';
import { parseMNode } from '../src/utils/nodeParser';
import { formatValue } from '../src/utils/graphRules';
import { variable } from '../src/utils/symbolicMath';
const graph = () => ({
  nodes: structuredClone(demo),
  connections: structuredClone(connections),
  frames: [],
});

test('Value nodes become inputs, result nodes become outputs, conversion and edits compute correctly', () => {
  const original = graph(),
    definition = createCompositeDefinition(
      original,
      demo.map((n) => n.id),
      definitions,
      'Sum',
    );
  expect(definition.inputs.map((s) => s.label)).toEqual(['Value A', 'Value B']);
  expect(definition.outputs.map((s) => s.label)).toEqual(['View Result']);
  expect(definition.composite?.connections).toEqual(connections);
  const replaced = replaceSelectionWithComposite(
    original,
    demo.map((n) => n.id),
    definition,
  );
  expect(replaced.nodes).toHaveLength(1);
  expect(replaced.connections).toHaveLength(0);
  const first = executeMathGraph(replaced.nodes, [], [definition]);
  expect(
    first.updatedNodes[0].computedOutputs?.[definition.outputs[0].name],
  ).toBe(42);
  expect(first.updatedNodes[0].computedGraph?.nodes).toHaveLength(4);
  const edited = {
    ...replaced.nodes[0],
    values: { [definition.inputs[0].name]: 2, [definition.inputs[1].name]: 3 },
  };
  expect(
    executeMathGraph([edited], [], [definition]).updatedNodes[0]
      .computedOutputs?.[definition.outputs[0].name],
  ).toBe(5);
  expect(original.nodes[0].values?.value).toBe(25);
});
test('outside wires are preserved and boundary inputs and outputs map correctly', () => {
  const original = graph(),
    selected = ['node-demo-op', 'node-demo-output'];
  const definition = createCompositeDefinition(
    original,
    selected,
    definitions,
    'Section',
  );
  expect(definition.inputs).toHaveLength(2);
  expect(definition.outputs).toHaveLength(1);
  const replaced = replaceSelectionWithComposite(
    original,
    selected,
    definition,
  );
  expect(replaced.connections).toHaveLength(2);
  const result = executeMathGraph(replaced.nodes, replaced.connections, [
    ...definitions,
    definition,
  ]);
  expect(
    result.updatedNodes.at(-1)?.computedOutputs?.[definition.outputs[0].name],
  ).toBe(42);
  const opOnly = createCompositeDefinition(
    original,
    ['node-demo-val1', 'node-demo-op'],
    definitions,
    'Op only',
  );
  const opGraph = replaceSelectionWithComposite(
    original,
    ['node-demo-val1', 'node-demo-op'],
    opOnly,
  );
  const opResult = executeMathGraph(opGraph.nodes, opGraph.connections, [
    ...definitions,
    opOnly,
  ]);
  expect(
    opResult.updatedNodes.find((n) => n.id === 'node-demo-output')
      ?.computedOutputs?.output,
  ).toBe(42);
});
test('two instances and nested reusable nodes have independent caches and defaults', () => {
  const original = graph(),
    definition = createCompositeDefinition(
      original,
      demo.map((n) => n.id),
      definitions,
      'Sum',
    );
  const replacement = replaceSelectionWithComposite(
    original,
    demo.map((n) => n.id),
    definition,
  );
  const a = {
    ...replacement.nodes[0],
    id: 'instance-a',
    values: { [definition.inputs[0].name]: 2, [definition.inputs[1].name]: 3 },
  };
  const b = {
    ...replacement.nodes[0],
    id: 'instance-b',
    values: { [definition.inputs[0].name]: 7, [definition.inputs[1].name]: 8 },
  };
  const result = executeMathGraph([a, b], [], [definition]);
  expect(
    result.updatedNodes.map(
      (n) => n.computedOutputs?.[definition.outputs[0].name],
    ),
  ).toEqual([5, 15]);
  const nestedNodes = [
    {
      id: 'nested-input',
      type: 'math.value',
      title: 'Nested input',
      x: 0,
      y: 0,
      values: { value: 2 },
    },
    a,
    {
      id: 'nested-output',
      type: 'math.output',
      title: 'Nested output',
      x: 0,
      y: 0,
    },
  ];
  const nestedWires = [
    {
      id: 'nested-in',
      fromNodeId: 'nested-input',
      fromSocket: 'value',
      toNodeId: a.id,
      toSocket: definition.inputs[0].name,
    },
    {
      id: 'nested-out',
      fromNodeId: a.id,
      fromSocket: definition.outputs[0].name,
      toNodeId: 'nested-output',
      toSocket: 'input',
    },
  ];
  const nestedGraph = { nodes: nestedNodes, connections: nestedWires };
  const wrapper = createCompositeDefinition(
    nestedGraph,
    nestedNodes.map((n) => n.id),
    [...definitions, definition],
    'Nested sum',
  );
  const portable = parseMNode(exportMNode(wrapper))!;
  expect(portable).not.toBeNull();
  const outer = replaceSelectionWithComposite(
    nestedGraph,
    nestedNodes.map((n) => n.id),
    portable,
  );
  expect(
    Object.values(
      executeMathGraph(outer.nodes, [], [portable]).updatedNodes[0]
        .computedOutputs!,
    ),
  ).toEqual([5]);
});
test('portable .mnode includes all internal kernels and supports symbolic inputs', () => {
  const original = graph(),
    definition = createCompositeDefinition(
      original,
      demo.map((n) => n.id),
      definitions,
      'Shared sum',
    );
  const imported = parseMNode(exportMNode(definition), 'friend-folder')!;
  expect(imported.folderId).toBe('friend-folder');
  expect(imported.composite?.definitions).toHaveLength(3);
  const wrapper = replaceSelectionWithComposite(
    original,
    demo.map((n) => n.id),
    imported,
  );
  wrapper.nodes[0].values = {
    [imported.inputs[0].name]: variable('A'),
    [imported.inputs[1].name]: variable('B'),
  };
  const result = executeMathGraph(wrapper.nodes, [], [imported]);
  expect(
    formatValue(
      result.updatedNodes[0].computedOutputs?.[imported.outputs[0].name],
    ),
  ).toBe('A + B');
});
test('invalid bindings and missing dependencies cannot be imported; internal errors surface on parent', () => {
  const original = graph(),
    definition = createCompositeDefinition(
      original,
      demo.map((n) => n.id),
      definitions,
      'Shared sum',
    );
  const invalid = structuredClone(definition);
  invalid.composite!.inputs[0].nodeId = 'missing';
  expect(parseMNode(JSON.stringify(invalid))).toBeNull();
  const missing = structuredClone(definition);
  missing.composite!.definitions = [];
  expect(parseMNode(JSON.stringify(missing))).toBeNull();
  const divide = structuredClone(definition);
  divide.composite!.nodes.find((n) => n.id === 'node-demo-op')!.values = {
    operation: 'Divide (/)',
  };
  const parent = replaceSelectionWithComposite(
    original,
    demo.map((n) => n.id),
    divide,
  );
  parent.nodes[0].values![divide.inputs[1].name] = 0;
  const error = executeMathGraph(parent.nodes, [], [divide]).updatedNodes[0]
    .error;
  expect(error).toContain('Inside Shared sum');
  expect(error).toContain('Division by zero');
});

test('normal external nodes can drive a reusable Value port and consume its result', () => {
  const original = graph(),
    definition = createCompositeDefinition(
      original,
      demo.map((n) => n.id),
      definitions,
      'Sum',
    );
  const wrapper = replaceSelectionWithComposite(
    original,
    demo.map((n) => n.id),
    definition,
  );
  const parent = wrapper.nodes[0];
  const source = {
    id: 'external-source',
    type: 'math.value',
    title: 'External',
    x: 0,
    y: 0,
    values: { value: 7 },
  };
  const sink = {
    id: 'external-result',
    type: 'math.output',
    title: 'Output',
    x: 0,
    y: 0,
  };
  const result = executeMathGraph(
    [source, parent, sink],
    [
      {
        id: 'input-wire',
        fromNodeId: source.id,
        fromSocket: 'value',
        toNodeId: parent.id,
        toSocket: definition.inputs[0].name,
      },
      {
        id: 'output-wire',
        fromNodeId: parent.id,
        fromSocket: definition.outputs[0].name,
        toNodeId: sink.id,
        toSocket: 'input',
      },
    ],
    [...definitions, definition],
  );
  expect(result.updatedNodes.at(-1)?.computedOutputs?.output).toBe(24);
});

test('creation requires multiple nodes, exposed inputs and outputs, and complete input-to-output paths', () => {
  const original = graph();
  expect(() =>
    createCompositeDefinition(
      original,
      ['node-demo-op'],
      definitions,
      'Single',
    ),
  ).toThrow('at least two');
  const constant = {
    id: 'constant',
    type: 'math.constant',
    title: 'Constant',
    x: 0,
    y: 0,
  };
  const output = {
    id: 'output',
    type: 'math.output',
    title: 'Output',
    x: 0,
    y: 0,
  };
  expect(() =>
    createCompositeDefinition(
      {
        nodes: [constant, output],
        connections: [
          {
            id: 'c',
            fromNodeId: 'constant',
            fromSocket: 'value',
            toNodeId: 'output',
            toSocket: 'input',
          },
        ],
      },
      ['constant', 'output'],
      definitions,
      'No input',
    ),
  ).toThrow('input');
  expect(() =>
    createCompositeDefinition(
      { nodes: demo.slice(0, 3), connections: connections.slice(0, 2) },
      demo.slice(0, 3).map((n) => n.id),
      definitions,
      'No output',
    ),
  ).toThrow('output');
  expect(() =>
    createCompositeDefinition(
      { nodes: [demo[0], demo[3]], connections: [] },
      [demo[0].id, demo[3].id],
      definitions,
      'Disconnected',
    ),
  ).toThrow('Connect');
  const unused = { ...demo[0], id: 'unused', title: 'Unused' };
  expect(() =>
    createCompositeDefinition(
      { ...original, nodes: [...original.nodes, unused] },
      [...demo.map((n) => n.id), unused.id],
      definitions,
      'Unused input',
    ),
  ).toThrow('Connect');
});

test('prefab conversion preserves assigned symbolic Value defaults', () => {
  const g = {
    nodes: [
      {
        id: 'a',
        type: 'math.value',
        title: 'A',
        x: 0,
        y: 0,
        values: { value: 'A', assigned: true, binding: 2 },
      },
      {
        id: 'b',
        type: 'math.value',
        title: 'B',
        x: 0,
        y: 300,
        values: { value: 'B', assigned: true, binding: 3 },
      },
      {
        id: 'sum',
        type: 'standard.add',
        title: 'Add',
        x: 300,
        y: 0,
        values: {},
      },
      {
        id: 'out',
        type: 'math.output',
        title: 'Output',
        x: 600,
        y: 0,
        values: {},
      },
    ],
    connections: [
      {
        id: 'a-s',
        fromNodeId: 'a',
        fromSocket: 'value',
        toNodeId: 'sum',
        toSocket: 'a',
      },
      {
        id: 'b-s',
        fromNodeId: 'b',
        fromSocket: 'value',
        toNodeId: 'sum',
        toSocket: 'b',
      },
      {
        id: 's-o',
        fromNodeId: 'sum',
        fromSocket: 'result',
        toNodeId: 'out',
        toSocket: 'input',
      },
    ],
    frames: [],
  };
  const definition = createCompositeDefinition(
    g,
    ['a', 'b', 'sum', 'out'],
    definitions,
    'Bound sum',
  );
  const replaced = replaceSelectionWithComposite(
    g,
    ['a', 'b', 'sum', 'out'],
    definition,
  );
  const evaluated = executeMathGraph(replaced.nodes, replaced.connections, [
    definition,
  ]);
  expect(
    formatValue(
      evaluated.updatedNodes[0].computedOutputs?.[definition.outputs[0].name],
    ),
  ).toBe('A + B = 5');
});

test('unpacking restores editable nodes and reconnects external inputs and output consumers', () => {
  const original = graph(),
    definition = createCompositeDefinition(
      original,
      demo.map((n) => n.id),
      definitions,
      'Unpack Sum',
    );
  const packed = replaceSelectionWithComposite(
    original,
    demo.map((n) => n.id),
    definition,
    'packed',
  );
  packed.nodes[0].values![definition.inputs[1].name] = 3;
  packed.nodes.push(
    {
      id: 'external',
      type: 'math.value',
      title: 'External',
      x: -300,
      y: 0,
      values: { value: 10 },
    },
    {
      id: 'sink',
      type: 'math.output',
      title: 'Sink',
      x: 600,
      y: 0,
      values: {},
    },
  );
  packed.connections.push(
    {
      id: 'external-in',
      fromNodeId: 'external',
      fromSocket: 'value',
      toNodeId: 'packed',
      toSocket: definition.inputs[0].name,
    },
    {
      id: 'external-out',
      fromNodeId: 'packed',
      fromSocket: definition.outputs[0].name,
      toNodeId: 'sink',
      toSocket: 'input',
    },
  );
  const unpacked = unpackComposite(packed, 'packed', definition);
  const result = executeMathGraph(unpacked.nodes, unpacked.connections, [
    ...definitions,
    definition,
  ]);
  expect(
    result.updatedNodes.find((n) => n.id === 'sink')?.computedOutputs?.output,
  ).toBe(13);
  expect(Object.values(result.errors).some(Boolean)).toBe(false);
  expect(unpacked.nodes.some((n) => n.id === 'packed')).toBe(false);
});
