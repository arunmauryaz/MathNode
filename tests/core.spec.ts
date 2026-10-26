import JSZip from 'jszip';
import { mergeDefinitions, readNodePackage } from '../src/utils/nodePackage';
import { test, expect } from '@playwright/test';
import { executeMathGraph } from '../src/utils/dagEngine';
import {
  DEFAULT_NODE_DEFINITIONS as defs,
  INITIAL_DEMO_NODES as demo,
  INITIAL_DEMO_CONNECTIONS as wires,
} from '../src/utils/defaultNodes';
import { parseGraph, exportGraph } from '../src/utils/graphFile';
import { connectionError } from '../src/utils/graphRules';
import { parseMNode } from '../src/utils/nodeParser';
import {
  getSocketWorldCenter,
  getNodeMinDimensions,
} from '../src/utils/socketGeometry';
import { readFileSync } from 'node:fs';

test('computes graph, changed inputs, and propagates division/domain errors', () => {
  expect(
    executeMathGraph(demo, wires, defs).updatedNodes.at(-1)?.computedOutputs
      ?.output,
  ).toBe(42);
  const changed = demo.map((n) =>
    n.id === 'node-demo-val1' ? { ...n, values: { value: 8 } } : n,
  );
  expect(
    executeMathGraph(changed, wires, defs).updatedNodes.at(-1)?.computedOutputs
      ?.output,
  ).toBe(25);
  const invalid = demo.map((n) =>
    n.id === 'node-demo-val2'
      ? { ...n, values: { value: 0 } }
      : n.id === 'node-demo-op'
        ? { ...n, values: { operation: 'Divide (/)' } }
        : n,
  );
  const result = executeMathGraph(invalid, wires, defs);
  expect(result.errors['node-demo-op']).toContain('Division by zero');
  expect(result.errors['node-demo-output']).toContain('Upstream error');
  const fn = {
    id: 'f',
    type: 'math.function',
    title: 'Function',
    x: 0,
    y: 0,
    values: { x: -1, func: 'sqrt(x)' },
  };
  expect(executeMathGraph([fn], [], defs).errors.f).toContain('sqrt requires');
});
test('constant and matrix kernels return correct results and reject dimensions', () => {
  const constant = {
    id: 'c',
    type: 'math.constant',
    title: 'Constant',
    x: 0,
    y: 0,
    values: { constant: 'φ (Golden ratio)' },
  };
  expect(
    executeMathGraph([constant], [], defs).updatedNodes[0].computedOutputs
      ?.value,
  ).toBeCloseTo(1.61803398875);
  const matrix = {
    id: 'm',
    type: 'math.matrix_mul',
    title: 'Matrix',
    x: 0,
    y: 0,
  };
  expect(
    executeMathGraph([matrix], [], defs).updatedNodes[0].computedOutputs?.C,
  ).toEqual([
    [4, 4],
    [10, 8],
  ]);
  expect(
    executeMathGraph([{ ...matrix, values: { A: [[1]] } }], [], defs).errors.m,
  ).toContain('2×2');
});
test('rejects invalid types, cycles, and missing definitions instead of producing stale values', () => {
  const cycle = {
    fromNodeId: 'node-demo-op',
    fromSocket: 'result',
    toNodeId: 'node-demo-op',
    toSocket: 'a',
  };
  expect(connectionError(cycle, demo, wires, defs)).toContain('cycle');
  const matrix = {
    id: 'm',
    type: 'math.matrix_mul',
    title: 'Matrix',
    x: 0,
    y: 0,
  };
  expect(
    connectionError(
      {
        fromNodeId: 'm',
        fromSocket: 'C',
        toNodeId: 'node-demo-op',
        toSocket: 'a',
      },
      [...demo, matrix],
      wires,
      defs,
    ),
  ).toContain('matrix to scalar');
  const cyclic = executeMathGraph(
    demo,
    [...wires, { ...cycle, id: 'cycle' }],
    defs,
  );
  expect(cyclic.errors['node-demo-op']).toContain('Cycle');
  expect(
    cyclic.updatedNodes.find((n) => n.id === 'node-demo-op')?.computedOutputs,
  ).toEqual({});
  expect(
    executeMathGraph([{ ...matrix, type: 'missing' }], [], defs).errors.m,
  ).toContain('Missing node definition');
});
test('workspace round trip retains values, connections, viewport and frames; invalid imports fail', () => {
  const graph = {
    id: 'round-trip',
    title: 'Graph',
    lastEdited: '',
    nodes: demo,
    connections: wires,
    pan: { x: 80, y: -40 },
    zoom: 0.7,
    frames: [
      {
        id: 'frame',
        title: 'Group',
        color: '#123456',
        x: -400,
        y: -100,
        width: 1000,
        height: 500,
      },
    ],
  };
  const text = exportGraph(graph);
  const restored = parseGraph(text);
  expect(restored.nodes?.length).toBe(4);
  expect(restored.connections).toEqual(wires.map(({ color: _c, ...c }) => c));
  expect(restored.frames).toEqual(graph.frames);
  expect(restored.pan).toEqual(graph.pan);
  expect(text).not.toContain('computedOutputs');
  expect(() => parseGraph('{"title":"not a graph"}')).toThrow();
  expect(() =>
    parseGraph(JSON.stringify({ ...graph, nodes: [...demo, demo[0]] })),
  ).toThrow('duplicate');
  expect(() =>
    parseGraph(
      JSON.stringify({
        ...graph,
        connections: [{ ...wires[0], toNodeId: 'gone' }],
      }),
    ),
  ).toThrow('connection');
});
test('custom node samples support body kernels and dropdowns; schema validation rejects malformed nodes', () => {
  for (const file of ['add_operator.mnode', 'all_in_one.mnode']) {
    const def = parseMNode(readFileSync(`examples/${file}`, 'utf8'))!;
    expect(def).not.toBeNull();
    const node = {
      id: 'custom',
      type: def.id,
      title: def.name,
      x: 0,
      y: 0,
      values: { A: 7, B: 3, Op: 'Multiply' },
    };
    const result = executeMathGraph([node], [], [def]);
    expect(result.errors.custom).toBeNull();
    expect(Object.values(result.updatedNodes[0].computedOutputs!)[0]).toBe(
      file === 'add_operator.mnode' ? 10 : 21,
    );
  }
  expect(
    parseMNode(
      '{"id":"bad","inputs":[{"name":"x","type":"unknown"}],"outputs":[]}',
    ),
  ).toBeNull();
});
test('geometry uses separate input/output rows and compact sockets remain on collapsed cards', () => {
  const node = {
    id: 'm',
    type: 'math.matrix_mul',
    title: 'Matrix',
    x: 20,
    y: 40,
  };
  const def = defs.find((d) => d.id === node.type)!;
  const a = getSocketWorldCenter(node, 'A', false, def),
    b = getSocketWorldCenter(node, 'B', false, def),
    c = getSocketWorldCenter(node, 'C', true, def);
  expect(a.y).toBeLessThan(b.y);
  expect(b.y).toBeLessThan(c.y);
  const collapsed = { ...node, collapsed: true };
  const min = getNodeMinDimensions(collapsed, def);
  expect(
    getSocketWorldCenter(collapsed, 'B', false, def).y - node.y,
  ).toBeLessThan(min.minHeight);
});

test('ZIP packages preserve folders, skip invalid files, and never create placeholder nodes', async () => {
  const zip = new JSZip();
  const example = readFileSync('examples/add_operator.mnode', 'utf8');
  zip.file('arithmetic/basic/add.mnode', example);
  zip.file('bad.mnode', '{"name":"broken"}');
  zip.file('photo.txt', 'not a node');
  const result = await readNodePackage(
    await zip.generateAsync({ type: 'uint8array' }),
    'My Package.zip',
  );
  expect(result.nodes).toHaveLength(1);
  expect(result.skipped).toBe(1);
  expect(result.folders.map((f) => f.name)).toEqual([
    'My Package',
    'arithmetic',
    'basic',
  ]);
  expect(result.nodes[0].folderId).toBe(result.folders[2].id);
  expect(
    mergeDefinitions(
      [result.nodes[0]],
      [{ ...result.nodes[0], description: 'updated' }],
    ),
  ).toHaveLength(1);
  expect(
    mergeDefinitions([result.nodes[0]], [{ ...result.nodes[0], id: 'other' }]),
  ).toHaveLength(2);
  const empty = new JSZip();
  empty.file('readme.txt', 'hello');
  await expect(
    readNodePackage(
      await empty.generateAsync({ type: 'uint8array' }),
      'Empty.zip',
    ),
  ).rejects.toThrow('no valid');
});
test('incremental evaluation reuses unaffected kernels and ignores layout changes', () => {
  const global = globalThis as unknown as Record<string, number>;
  const definition = (id: string) => ({
    id,
    name: id,
    inputs: [{ name: 'x', type: 'scalar' as const, default: 1 }],
    outputs: [{ name: 'y', type: 'scalar' as const }],
    code: `(inputs) => { globalThis['${id}'] = (globalThis['${id}'] || 0) + 1; return { y: inputs.x + 1 }; }`,
  });
  const definitions = ['cacheA', 'cacheB', 'cacheC'].map(definition);
  const nodes = definitions.map((d) => ({
    id: d.id,
    type: d.id,
    title: d.id,
    x: 0,
    y: 0,
    values: { x: 1 },
  }));
  const connections = [
    {
      id: 'cache-wire',
      fromNodeId: 'cacheA',
      fromSocket: 'y',
      toNodeId: 'cacheB',
      toSocket: 'x',
    },
  ];
  executeMathGraph(nodes, connections, definitions);
  executeMathGraph(
    nodes.map((n) => ({ ...n, x: 200 })),
    connections,
    definitions,
  );
  expect([global.cacheA, global.cacheB, global.cacheC]).toEqual([1, 1, 1]);
  executeMathGraph(
    nodes.map((n) => (n.id === 'cacheA' ? { ...n, values: { x: 3 } } : n)),
    connections,
    definitions,
  );
  expect([global.cacheA, global.cacheB, global.cacheC]).toEqual([2, 2, 1]);
  for (const key of ['cacheA', 'cacheB', 'cacheC']) delete global[key];
});
test('error provenance distinguishes the failed operator from blocked dependents and resets on recovery', () => {
  const invalid = demo.map((n) =>
    n.id === 'node-demo-val2'
      ? { ...n, values: { value: 0 } }
      : n.id === 'node-demo-op'
        ? { ...n, values: { operation: 'Divide (/)' } }
        : n,
  );
  const result = executeMathGraph(invalid, wires, defs);
  const failure = result.updatedNodes.find((n) => n.id === 'node-demo-op')!,
    dependent = result.updatedNodes.find((n) => n.id === 'node-demo-output')!;
  expect(failure.errorKind).toBe('calculation');
  expect(failure.errorSourceNodeId).toBe(failure.id);
  expect(dependent.errorKind).toBe('upstream');
  expect(dependent.errorSourceNodeId).toBe(failure.id);
  expect(dependent.errorConnectionIds).toEqual(['conn-3']);
  const recovered = executeMathGraph(demo, wires, defs);
  expect(
    recovered.updatedNodes.every(
      (n) =>
        n.error === null &&
        n.errorKind === undefined &&
        !n.errorConnectionIds?.length,
    ),
  ).toBe(true);
});
