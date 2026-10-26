import { test, expect } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
let client: Client,
  transport: StdioClientTransport,
  directory: string,
  port: number;
const call = async (name: string, args: Record<string, unknown> = {}) => {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError)
    throw Error(
      (result.content as { text: string }[]).map((c) => c.text).join('\n'),
    );
  return (result.structuredContent ||
    JSON.parse((result.content as { text: string }[])[0].text)) as any;
};
test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'mathnode-mcp-test-'));
  client = new Client({ name: 'mathnode-integration-test', version: '1.0.0' });
  transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      resolve('scripts/mcp-server.mjs'),
      '--workspace',
      directory,
      '--bridge-port',
      '0',
    ],
    stderr: 'pipe',
  });
  await client.connect(transport);
  port = (await call('server_status')).bridgePort;
});
test.afterAll(async () => {
  await client?.close();
  await rm(directory, { recursive: true, force: true });
});

test('MCP discovery, resources, prompts and formula-to-step execution work over stdio', async () => {
  const tools = await client.listTools();
  expect(tools.tools.length).toBeGreaterThanOrEqual(30);
  const resources = await client.listResources();
  expect(resources.resources.map((r) => r.uri)).toContain(
    'mathnode://agent-guide',
  );
  expect(
    (await client.readResource({ uri: 'mathnode://agent-guide' })).contents[0],
  ).toHaveProperty('text');
  expect(
    (
      await client.getPrompt({
        name: 'solve-math',
        arguments: { request: 'Expand (A+B)^2' },
      })
    ).messages[0].content,
  ).toHaveProperty('text');
  const nodes = await call('library_search', { query: 'root' });
  expect(nodes.nodes.some((n: any) => n.id === 'standard.sqrt')).toBeTruthy();
  const p = await call('graph_from_formula', {
    name: 'Whole square',
    latex: '(A+B)^2',
    bindings: { A: 2, B: 3 },
  });
  expect(p.graph.nodes.filter((n: any) => n.type === 'math.value').length).toBe(
    3,
  );
  const execution = await call('graph_execute', { projectId: p.id });
  expect(execution.success).toBe(true);
  const result = execution.nodes.find((n: any) => n.type === 'math.output');
  expect(result.display.output.latex).toContain('25');
  const exported = await call('project_export', { projectId: p.id });
  expect(JSON.parse(await readFile(exported.path, 'utf8')).format).toBe(
    'mathnode-project',
  );
  const restored = await call('project_import', {
    name: 'Restored',
    content: JSON.stringify(exported.bundle),
  });
  expect(
    (await call('graph_execute', { projectId: restored.id })).success,
  ).toBe(true);
});

test('atomic edits, revisions, input ownership, cycle guards and undo preserve valid graphs', async () => {
  const p = await call('project_create', { name: 'Edits' });
  const batch = await call('graph_edit', {
    projectId: p.id,
    expectedRevision: 0,
    operations: [
      {
        op: 'add_node',
        node: { id: 'a', definitionId: 'math.value', values: { value: 2 } },
      },
      { op: 'add_node', node: { id: 'b', definitionId: 'standard.square' } },
      {
        op: 'connect',
        connection: {
          id: 'wire',
          fromNodeId: 'a',
          fromSocket: 'value',
          toNodeId: 'b',
          toSocket: 'x',
        },
      },
    ],
  });
  expect(batch.revision).toBe(1);
  await expect(
    call('graph_update_node', {
      projectId: p.id,
      expectedRevision: 0,
      patch: { nodeId: 'a', values: { value: 5 } },
    }),
  ).rejects.toThrow('Revision conflict');
  await expect(
    call('graph_connect', {
      projectId: p.id,
      connection: {
        fromNodeId: 'a',
        fromSocket: 'value',
        toNodeId: 'b',
        toSocket: 'x',
      },
    }),
  ).rejects.toThrow('already connected');
  await expect(
    call('graph_edit', {
      projectId: p.id,
      operations: [
        { op: 'update_node', patch: { nodeId: 'a', values: { value: 9 } } },
        {
          op: 'connect',
          connection: {
            fromNodeId: 'b',
            fromSocket: 'result',
            toNodeId: 'b',
            toSocket: 'x',
          },
          replace: true,
        },
      ],
    }),
  ).rejects.toThrow('cycle');
  expect(
    (await call('project_get', { projectId: p.id })).graph.nodes[0].values
      .value,
  ).toBe(2);
  await call('graph_history', { projectId: p.id, direction: 'undo' });
  expect(
    (await call('project_get', { projectId: p.id })).graph.nodes,
  ).toHaveLength(0);
  await call('graph_history', { projectId: p.id, direction: 'redo' });
  expect(
    (await call('graph_execute', { projectId: p.id })).nodes[1].computedOutputs
      .result,
  ).toBe(4);
});

test('agents create, share, instantiate and unpack prefabs with symbolic defaults and numeric overrides', async () => {
  const p = await call('project_create', { name: 'Reusable' });
  const updated = await call('graph_edit', {
    projectId: p.id,
    operations: [
      {
        op: 'add_node',
        node: {
          id: 'a',
          definitionId: 'math.value',
          title: 'A',
          values: { value: 'A' },
        },
      },
      {
        op: 'add_node',
        node: {
          id: 'b',
          definitionId: 'math.value',
          title: 'B',
          values: { value: 'B' },
        },
      },
      { op: 'add_node', node: { id: 'sum', definitionId: 'standard.add' } },
      {
        op: 'add_node',
        node: { id: 'square', definitionId: 'standard.square' },
      },
      { op: 'add_node', node: { id: 'out', definitionId: 'math.output' } },
      ...[
        ['a', 'value', 'sum', 'a'],
        ['b', 'value', 'sum', 'b'],
        ['sum', 'result', 'square', 'x'],
        ['square', 'result', 'out', 'input'],
      ].map(([fromNodeId, fromSocket, toNodeId, toSocket]) => ({
        op: 'connect',
        connection: { fromNodeId, fromSocket, toNodeId, toSocket },
      })),
    ],
  });
  await call('graph_layout', { projectId: p.id });
  const group = await call('group_create', {
    projectId: p.id,
    name: 'Equation',
    nodeIds: ['a', 'b', 'sum', 'square', 'out'],
  });
  expect(group.graph.frames).toHaveLength(1);
  const prefab = await call('prefab_create', {
    projectId: p.id,
    name: 'Whole Square',
    nodeIds: ['a', 'b', 'sum', 'square', 'out'],
  });
  expect(prefab.definition.inputs).toHaveLength(2);
  expect(prefab.graph.nodes).toHaveLength(1);
  const instance = prefab.graph.nodes[0],
    first = prefab.definition.inputs[0].name,
    second = prefab.definition.inputs[1].name;
  await call('graph_update_node', {
    projectId: p.id,
    patch: { nodeId: instance.id, values: { [first]: 2, [second]: 3 } },
  });
  const result = await call('graph_execute', { projectId: p.id });
  expect(
    result.nodes[0].computedOutputs[prefab.definition.outputs[0].name],
  ).toBe(25);
  const file = await call('library_export', {
    projectId: p.id,
    definitionId: prefab.definition.id,
  });
  expect(JSON.parse(file.content).composite.nodes).toHaveLength(5);
  await call('prefab_unpack', { projectId: p.id, nodeId: instance.id });
  const unpacked = await call('graph_execute', { projectId: p.id });
  expect(unpacked.success).toBe(true);
  expect(
    unpacked.nodes.find((n: any) => n.type === 'math.output').computedOutputs
      .output,
  ).toBe(25);
});

test('custom kernels install and run without corrupting stdio, expose errors, and time out safely', async () => {
  const folder = (await call('library_folder_create', { name: 'Agent Nodes' }))
    .folder;
  const definition = {
    id: 'agent.double',
    name: 'Agent Double',
    inputs: [{ name: 'x', type: 'scalar', default: 3, widget: 'number' }],
    outputs: [{ name: 'result', type: 'scalar' }],
    code: "(inputs, math) => { console.log('kernel log'); return {result:math.operate('*',inputs.x,2)}; }",
  };
  await call('library_install', { definition, folderId: folder.id });
  const p = await call('project_create', { name: 'Custom' });
  await call('graph_add_node', {
    projectId: p.id,
    node: { definitionId: definition.id, id: 'custom' },
  });
  expect(
    (await call('graph_execute', { projectId: p.id })).nodes[0].computedOutputs
      .result,
  ).toBe(6);
  expect((await call('server_status')).version).toBe('1.0.0');
  await call('library_install', {
    definition: {
      ...definition,
      id: 'agent.hang',
      name: 'Hang',
      code: '() => { while(true) {} }',
    },
  });
  const hung = await call('project_create', { name: 'Deadline' });
  await call('graph_add_node', {
    projectId: hung.id,
    node: { definitionId: 'agent.hang' },
  });
  await expect(call('graph_execute', { projectId: hung.id })).rejects.toThrow(
    'deadline',
  );
  expect(
    (await call('project_get', { projectId: p.id })).graph.nodes,
  ).toHaveLength(1);
  await expect(
    call('library_install', {
      definition: { ...definition, id: 'math.value' },
    }),
  ).rejects.toThrow('reserved');
});

test('live bridge rejects remote origins and stale tokens', async () => {
  const base = `http://127.0.0.1:${port}`;
  expect(
    (
      await fetch(base + '/bridge/session', {
        headers: { Origin: 'https://evil.example' },
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await fetch(base + '/bridge/sync', {
        method: 'POST',
        headers: {
          Origin: 'http://127.0.0.1:4178',
          'X-MathNode-Token': 'wrong',
        },
      })
    ).status,
  ).toBe(403);
});

test('live browser pulls, applies agent edits, preserves undo and detects manual-edit conflicts', async ({
  page,
}) => {
  await page.addInitScript(
    ({ port }) => {
      localStorage.setItem('mn_show_startup', 'false');
      localStorage.setItem(
        'mn_user_settings',
        JSON.stringify({
          showStartupModal: false,
          showMinimap: false,
          snapToGrid: true,
          gridDotSpacing: 24,
          autoSave: true,
          precision: 6,
          mcpEnabled: true,
          mcpPort: port,
        }),
      );
    },
    { port },
  );
  await page.goto('/');
  await expect
    .poll(async () => (await call('live_status')).connected)
    .toBe(true);
  const pulled = await call('live_pull');
  expect(pulled.graph.nodes).toHaveLength(4);
  const source = pulled.graph.nodes[0];
  await call('graph_update_node', {
    projectId: pulled.id,
    patch: { nodeId: source.id, values: { value: 50 } },
  });
  await expect(
    page
      .locator(`[data-node-id="${source.id}"]`)
      .getByLabel('Value', { exact: true }),
  ).toHaveValue('50');
  await expect
    .poll(async () => (await call('live_status')).appliedRevision)
    .toBe(1);
  await page.keyboard.press('Control+z');
  await expect(
    page
      .locator(`[data-node-id="${source.id}"]`)
      .getByLabel('Value', { exact: true }),
  ).toHaveValue('25');
  await expect
    .poll(async () => (await call('live_status')).liveHash)
    .not.toBe((await call('live_status')).synchronizedHash);
  await page
    .locator(`[data-node-id="${source.id}"]`)
    .getByLabel('Value', { exact: true })
    .fill('31');
  await page
    .locator(`[data-node-id="${source.id}"]`)
    .getByLabel('Value', { exact: true })
    .blur();
  await page.waitForTimeout(1200);
  await expect(
    call('graph_update_node', {
      projectId: pulled.id,
      patch: { nodeId: source.id, values: { value: 99 } },
    }),
  ).rejects.toThrow('Live canvas changed');
  const refreshed = await call('live_pull', { projectId: pulled.id });
  expect(refreshed.graph.nodes[0].values.value).toBe(31);
  await page.reload();
  await expect(
    page
      .locator(`[data-node-id="${source.id}"]`)
      .getByLabel('Value', { exact: true }),
  ).toHaveValue('31');
  await call('graph_update_node', {
    projectId: pulled.id,
    patch: { nodeId: source.id, values: { value: 44 } },
  });
  await expect(
    page
      .locator(`[data-node-id="${source.id}"]`)
      .getByLabel('Value', { exact: true }),
  ).toHaveValue('44');
});

test('saved projects and the custom library survive an MCP process restart', async () => {
  await call('library_install', {
    definition: {
      id: 'agent.persisted',
      name: 'Persisted Kernel',
      inputs: [],
      outputs: [{ name: 'result', type: 'scalar' }],
      code: '() => ({result:7})',
    },
  });
  const p = await call('project_create', { name: 'Persistence' });
  await call('graph_add_node', {
    projectId: p.id,
    node: { definitionId: 'math.value', values: { value: 42 } },
  });
  await client.close();
  await expect
    .poll(async () => {
      try {
        await readFile(join(directory, 'server.lock'));
        return false;
      } catch {
        return true;
      }
    })
    .toBe(true);
  client = new Client({ name: 'mathnode-restart-test', version: '1.0.0' });
  transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      resolve('scripts/mcp-server.mjs'),
      '--workspace',
      directory,
      '--bridge-port',
      '0',
    ],
    stderr: 'pipe',
  });
  await client.connect(transport);
  expect(
    (await call('project_get', { projectId: p.id })).graph.nodes[0].values
      .value,
  ).toBe(42);
  expect(
    (await call('library_get', { definitionId: 'agent.persisted' })).name,
  ).toBe('Persisted Kernel');
});

test('live acknowledgements distinguish queued commands and reject edits made before acknowledgement', async () => {
  const { createBridge, hash } = await import('../mcp/bridge.mjs');
  const bridge = createBridge(0),
    localPort = await bridge.start(),
    base = `http://127.0.0.1:${localPort}`,
    origin = 'http://127.0.0.1:4178';
  try {
    const token = (
      await (
        await fetch(base + '/bridge/session', { headers: { Origin: origin } })
      ).json()
    ).token;
    const sync = async (snapshot: any, extra: any = {}) =>
      (
        await fetch(base + '/bridge/sync', {
          method: 'POST',
          headers: {
            Origin: origin,
            'Content-Type': 'application/json',
            'X-MathNode-Token': token,
          },
          body: JSON.stringify({
            clientId: 'test-browser',
            snapshot,
            ...extra,
          }),
        })
      ).json();
    const initial = {
      graph: { id: 'test', nodes: [], connections: [] },
      definitions: [],
      folders: [],
    };
    await sync(initial);
    const first = {
      id: 'test',
      revision: 1,
      graph: { ...initial.graph, title: 'First' },
    };
    bridge.push(first, [], []);
    const firstCommand = bridge.state.pending!.commandId;
    const second = {
      ...first,
      revision: 2,
      graph: { ...first.graph, title: 'Second' },
    };
    bridge.push(second, [], []);
    const secondCommand = bridge.state.pending!.commandId;
    expect(secondCommand).not.toBe(firstCommand);
    const appliedFirst = { ...initial, graph: first.graph };
    const afterFirst = await sync(appliedFirst, {
      ackId: firstCommand,
      ackHash: hash(appliedFirst),
    });
    expect(afterFirst.pending.commandId).toBe(secondCommand);
    expect(afterFirst.error).toBeNull();
    const appliedSecond = { ...initial, graph: second.graph },
      manual = {
        ...appliedSecond,
        graph: { ...second.graph, title: 'Manual' },
      };
    const conflict = await sync(manual, {
      ackId: secondCommand,
      ackHash: hash(appliedSecond),
    });
    expect(conflict.error).toContain('Canvas changed after');
    expect(conflict.pending).toBeNull();
    const third = {
      ...second,
      revision: 3,
      graph: { ...second.graph, title: 'Third' },
    };
    bridge.push(third, [], []);
    const thirdCommand = bridge.state.pending!.commandId,
      appliedThird = { ...initial, graph: third.graph };
    const recovered = await sync(appliedThird, {
      ackId: thirdCommand,
      ackHash: hash(appliedThird),
    });
    expect(recovered.error).toBeNull();
    expect(bridge.state.appliedRevision).toBe(3);
  } finally {
    await bridge.close();
  }
});
