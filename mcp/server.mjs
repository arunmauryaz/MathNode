import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { Worker } from 'node:worker_threads';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Workspace } from './workspace.mjs';
import { createBridge } from './bridge.mjs';

export async function startServer({
  core,
  coreUrl,
  root,
  bridgePort = 4319,
  transport = new StdioServerTransport(),
}) {
  const workspace = new Workspace(root, core);
  await workspace.init();
  const bridge = createBridge(bridgePort);
  let port = null;
  if (bridgePort !== false)
    try {
      port = await bridge.start();
    } catch (e) {
      console.error(
        `Live bridge unavailable: ${e.message}. File project tools remain available.`,
      );
    }
  const server = new McpServer(
    { name: 'mathnode', version: '1.0.0' },
    {
      instructions:
        'Read mathnode://agent-guide first. Discover node schemas before connecting. Prefer graph_edit for an atomic batch, execute to inspect per-node math errors, then prefab_create to reuse a validated selection. Only Value nodes represent numbers and symbols. MCP projects are persisted independently; use live_pull/live_push to attach the canvas. Revisions prevent stale edits. Custom JavaScript runs in deadline-limited workers, not a security sandbox.',
    },
  );
  let queue = Promise.resolve();
  const clean = (p) => ({
    ...workspace.summary(p),
    graph: p.graph,
    definitions: p.definitions,
  });
  const snapshot = (p) => ({
    graph: p.graph,
    definitions: workspace.definitions(p),
    folders: [...core.DEFAULT_FOLDERS, ...workspace.folders],
  });
  const liveEditable = (id) => {
    const s = bridge.state;
    if (
      s.boundProjectId === id &&
      bridge.connected() &&
      (s.conflicted || (s.synchronizedHash && s.hash !== s.synchronizedHash)) &&
      !s.pending
    )
      throw Error(
        'Live canvas changed. Call live_pull before editing this project.',
      );
  };
  const commit = async (id, draft, revision) => {
    liveEditable(id);
    const next = await workspace.commit(id, draft, revision);
    if (bridge.state.boundProjectId === id && bridge.connected())
      bridge.push(next, workspace.definitions(next), snapshot(next).folders);
    return clean(next);
  };
  function tool(name, description, inputSchema, handler, readOnly = false) {
    server.registerTool(
      name,
      {
        description,
        inputSchema,
        annotations: {
          readOnlyHint: readOnly,
          destructiveHint: !readOnly,
          idempotentHint: readOnly,
          openWorldHint: false,
        },
      },
      async (args, extra) => {
        const action = async () => {
          try {
            const result = await handler(args, extra);
            const structuredContent =
              result && typeof result === 'object' && !Array.isArray(result)
                ? result
                : { data: result };
            return {
              content: [
                { type: 'text', text: JSON.stringify(structuredContent) },
              ],
              structuredContent,
            };
          } catch (e) {
            return {
              isError: true,
              content: [{ type: 'text', text: e.message }],
            };
          }
        };
        if (readOnly) return action();
        const result = queue.then(action, action);
        queue = result.then(() => {});
        return result;
      },
    );
  }
  const id = z.string().min(1).max(160),
    projectId = id.describe(
      'ID returned by project_create, project_list, or live_pull',
    ),
    revision = z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe('Optimistic revision; stale edits are rejected'),
    values = z.record(z.string(), z.unknown());
  const nodeSpec = z.object({
    id: id.optional(),
    definitionId: id,
    title: z.string().max(200).optional(),
    x: z.number().finite().default(0),
    y: z.number().finite().default(0),
    values: values.default({}),
  });
  const wireSpec = z.object({
    id: id.optional(),
    fromNodeId: id,
    fromSocket: id,
    toNodeId: id,
    toSocket: id,
  });
  const patchSpec = z.object({
    nodeId: id,
    title: z.string().max(200).optional(),
    x: z.number().finite().optional(),
    y: z.number().finite().optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    collapsed: z.boolean().optional(),
    values: values.optional(),
  });
  const operation = z.discriminatedUnion('op', [
    z.object({ op: z.literal('add_node'), node: nodeSpec }),
    z.object({ op: z.literal('update_node'), patch: patchSpec }),
    z.object({ op: z.literal('delete_node'), nodeId: id }),
    z.object({
      op: z.literal('connect'),
      connection: wireSpec,
      replace: z.boolean().default(false),
    }),
    z.object({ op: z.literal('disconnect'), connectionId: id }),
  ]);
  async function edit({ projectId, expectedRevision, operations }) {
    liveEditable(projectId);
    const p = structuredClone(workspace.project(projectId)),
      defs = workspace.definitions(p);
    for (const op of operations) {
      if (op.op === 'add_node') {
        const s = op.node,
          d = defs.find((d) => d.id === s.definitionId);
        if (!d) throw Error(`Unknown definition: ${s.definitionId}`);
        const nodeId = s.id || randomUUID();
        if (p.graph.nodes.some((n) => n.id === nodeId))
          throw Error('Node ID already exists');
        const defaults = Object.fromEntries(
          d.inputs
            .filter((s) => s.default !== undefined)
            .map((s) => [s.name, s.default]),
        );
        p.graph.nodes.push({
          id: nodeId,
          type: d.id,
          definitionId: d.id,
          title: s.title || d.name,
          x: s.x,
          y: s.y,
          values: {
            ...defaults,
            ...(d.id === 'math.value' ? { value: 10 } : {}),
            ...s.values,
          },
        });
      }
      if (op.op === 'update_node') {
        const { nodeId, values, ...patch } = op.patch,
          n = p.graph.nodes.find((n) => n.id === nodeId);
        if (!n) throw Error('Node does not exist');
        Object.assign(n, patch);
        if (values) n.values = { ...n.values, ...values };
      }
      if (op.op === 'delete_node') {
        if (!p.graph.nodes.some((n) => n.id === op.nodeId))
          throw Error('Node does not exist');
        p.graph.nodes = p.graph.nodes.filter((n) => n.id !== op.nodeId);
        p.graph.connections = p.graph.connections.filter(
          (c) => c.fromNodeId !== op.nodeId && c.toNodeId !== op.nodeId,
        );
        p.graph.frames = (p.graph.frames || [])
          .map((f) => ({
            ...f,
            nodeIds: f.nodeIds?.filter((id) => id !== op.nodeId),
          }))
          .filter((f) => !f.nodeIds || f.nodeIds.length);
      }
      if (op.op === 'connect') {
        const c = { ...op.connection, id: op.connection.id || randomUUID() },
          occupied = p.graph.connections.find(
            (w) => w.toNodeId === c.toNodeId && w.toSocket === c.toSocket,
          );
        if (occupied && !op.replace)
          throw Error(
            'Input is already connected; set replace=true to reconnect',
          );
        if (occupied)
          p.graph.connections = p.graph.connections.filter(
            (w) => w.id !== occupied.id,
          );
        const error = core.connectionError(
          c,
          p.graph.nodes,
          p.graph.connections,
          defs,
        );
        if (error) throw Error(error);
        p.graph.connections.push(c);
      }
      if (op.op === 'disconnect') {
        if (!p.graph.connections.some((c) => c.id === op.connectionId))
          throw Error('Connection does not exist');
        p.graph.connections = p.graph.connections.filter(
          (c) => c.id !== op.connectionId,
        );
      }
    }
    return commit(projectId, p, expectedRevision);
  }
  tool(
    'server_status',
    'Server paths, capabilities, live browser status, and limits.',
    {},
    () => ({
      version: '1.0.0',
      workspace: workspace.root,
      bridgePort: port,
      live: bridge.status(),
      limits: { nodes: 2000, wires: 10000, executionMs: 3000, history: 50 },
      transport: 'stdio',
    }),
    true,
  );
  tool(
    'project_list',
    'List saved MCP projects. Browser-only projects require live_pull.',
    {},
    () => ({
      projects: [...workspace.projects.values()].map((p) =>
        workspace.summary(p),
      ),
    }),
    true,
  );
  tool(
    'project_create',
    'Create and persist an empty mathematical graph.',
    { name: z.string().min(1).max(200) },
    async ({ name }) => clean(await workspace.create(name)),
  );
  tool(
    'project_get',
    'Read an entire graph, its reusable definitions, and current revision.',
    { projectId },
    ({ projectId }) => clean(workspace.project(projectId)),
    true,
  );
  tool(
    'project_import',
    'Import a .mathnode graph and optional dependency definitions atomically. Does not execute code.',
    {
      name: z.string().min(1).max(200),
      content: z.string().max(8_000_000),
      definitions: z.array(z.unknown()).max(2000).default([]),
    },
    async ({ name, content, definitions }) => {
      const raw = JSON.parse(content),
        bundle = raw.format === 'mathnode-project' ? raw : null;
      return clean(
        await workspace.create(
          name,
          core.parseGraph(JSON.stringify(bundle ? bundle.graph : raw)),
          [...(bundle?.definitions || []), ...definitions].map((d) =>
            core.validateNode(JSON.stringify(d)),
          ),
        ),
      );
    },
  );
  tool(
    'project_export',
    'Write a portable project bundle JSON under exports and return its content. Bundle contains graph, custom dependencies, and format version.',
    { projectId },
    async ({ projectId }) => {
      const p = workspace.project(projectId),
        used = new Set(p.graph.nodes.map((n) => n.definitionId || n.type));
      const bundle = {
        format: 'mathnode-project',
        version: 1,
        graph: p.graph,
        definitions: workspace.definitions(p).filter((d) => used.has(d.id)),
      };
      await workspace.atomic(`exports/${p.id}.mathnode-project.json`, bundle);
      return {
        path: join(workspace.root, 'exports', `${p.id}.mathnode-project.json`),
        bundle,
      };
    },
  );
  tool(
    'library_search',
    'Search the full installed library. Returns port summaries; use library_get for complete schema and source.',
    {
      query: z.string().default(''),
      projectId: projectId.optional(),
      limit: z.number().int().min(1).max(200).default(30),
    },
    ({ query, projectId, limit }) => ({
      nodes: workspace
        .definitions(projectId ? workspace.project(projectId) : null)
        .filter((d) => core.matchesNode(d, query) || d.id.includes(query))
        .slice(0, limit)
        .map(({ id, name, description, inputs, outputs, composite }) => ({
          id,
          name,
          description,
          inputs,
          outputs,
          kind: composite ? 'prefab' : 'kernel',
        })),
    }),
    true,
  );
  tool(
    'library_get',
    'Inspect a node schema, kernel or nested prefab internals without running it.',
    { definitionId: id, projectId: projectId.optional() },
    ({ definitionId, projectId }) => {
      const d = workspace
        .definitions(projectId ? workspace.project(projectId) : null)
        .find((d) => d.id === definitionId);
      if (!d) throw Error('Unknown node definition');
      return d;
    },
    true,
  );
  tool(
    'library_install',
    'Install a validated custom JavaScript kernel or composite .mnode. Code may use math.value/operate/call/collections. Installing does not execute it. Bundled IDs are reserved.',
    { definition: z.unknown(), folderId: id.optional() },
    async ({ definition, folderId }) => ({
      definition: await workspace.install(
        core.validateNode(JSON.stringify(definition)),
        folderId,
      ),
    }),
  );
  tool(
    'library_export',
    'Export a custom or bundled definition as a portable .mnode.',
    { definitionId: id, projectId: projectId.optional() },
    async ({ definitionId, projectId }) => {
      const d = workspace
        .definitions(projectId ? workspace.project(projectId) : null)
        .find((d) => d.id === definitionId);
      if (!d) throw Error('Unknown definition');
      const filename = d.id.replace(/[^a-zA-Z0-9_-]/g, '_') + '.mnode';
      await workspace.atomic(
        `exports/${filename}`,
        JSON.parse(core.exportMNode(d)),
      );
      return {
        path: join(workspace.root, 'exports', filename),
        content: core.exportMNode(d),
      };
    },
  );
  tool(
    'library_folder_create',
    'Create a folder for agent-authored or prefab nodes.',
    { name: z.string().min(1).max(100), parentId: id.nullable().default(null) },
    async ({ name, parentId }) => {
      if (
        parentId &&
        ![...core.DEFAULT_FOLDERS, ...workspace.folders].some(
          (f) => f.id === parentId,
        )
      )
        throw Error('Unknown parent folder');
      const folder = { id: randomUUID(), name, parentId };
      workspace.folders.push(folder);
      await workspace.atomic('library.json', {
        definitions: workspace.library,
        folders: workspace.folders,
      });
      return { folder };
    },
  );
  tool(
    'library_move',
    'Move an agent-installed node to an existing library folder.',
    { definitionId: id, folderId: id },
    async ({ definitionId, folderId }) => {
      if (
        ![...core.DEFAULT_FOLDERS, ...workspace.folders].some(
          (f) => f.id === folderId,
        )
      )
        throw Error('Unknown folder');
      const d = workspace.library.find((d) => d.id === definitionId);
      if (!d) throw Error('Only installed custom nodes can be moved');
      return { definition: await workspace.install(d, folderId) };
    },
  );
  tool(
    'graph_edit',
    'Apply 1–500 graph edits as one validated transaction and undo step. Node IDs supplied by you may be referenced by later operations. Rejects cycles, duplicate IDs, occupied input ports, bad types and missing sockets; no partial graph edits on failure.',
    {
      projectId,
      expectedRevision: revision,
      operations: z.array(operation).min(1).max(500),
    },
    edit,
  );
  tool(
    'graph_add_node',
    'Add one library node. Value accepts numbers, symbols, or LaTeX in values.value.',
    { projectId, expectedRevision: revision, node: nodeSpec },
    (args) =>
      edit({ ...args, operations: [{ op: 'add_node', node: args.node }] }),
  );
  tool(
    'graph_update_node',
    'Update node controls, title, size or position; control values merge with existing values.',
    { projectId, expectedRevision: revision, patch: patchSpec },
    (args) =>
      edit({ ...args, operations: [{ op: 'update_node', patch: args.patch }] }),
  );
  tool(
    'graph_delete_node',
    'Delete a node and all incident connections.',
    { projectId, expectedRevision: revision, nodeId: id },
    (args) =>
      edit({
        ...args,
        operations: [{ op: 'delete_node', nodeId: args.nodeId }],
      }),
  );
  tool(
    'graph_connect',
    'Connect compatible ports. An input has exactly one incoming wire; replace=true moves an existing connection.',
    {
      projectId,
      expectedRevision: revision,
      connection: wireSpec,
      replace: z.boolean().default(false),
    },
    (args) =>
      edit({
        ...args,
        operations: [
          { op: 'connect', connection: args.connection, replace: args.replace },
        ],
      }),
  );
  tool(
    'graph_disconnect',
    'Remove one wire.',
    { projectId, expectedRevision: revision, connectionId: id },
    (args) =>
      edit({
        ...args,
        operations: [{ op: 'disconnect', connectionId: args.connectionId }],
      }),
  );
  tool(
    'graph_validate',
    'Check schema, definitions, port compatibility and cycles without executing any code.',
    { projectId },
    ({ projectId }) => {
      const p = workspace.project(projectId);
      workspace.validate(p.graph, workspace.definitions(p));
      return { valid: true, revision: p.revision };
    },
    true,
  );
  tool(
    'graph_from_formula',
    'Create a new step-by-step graph from a LaTeX formula. Reuses Value sources for repeated symbols. Arithmetic, powers, roots and common functions become separate connected nodes. Other valid expressions remain atomic Value formulas. Optional numeric bindings retain symbol names.',
    {
      name: z.string().min(1).max(200),
      latex: z.string().min(1).max(4096),
      bindings: z.record(z.string(), z.number().finite()).default({}),
    },
    async ({ name, latex, bindings }) => {
      const plan = core.formulaGraph(latex, bindings),
        p = await workspace.create(name, plan.graph);
      return {
        ...clean(p),
        steps: plan.steps,
        unknowns: plan.unknowns,
        latex: plan.latex,
      };
    },
  );
  tool(
    'graph_layout',
    'Arrange a DAG in layers from left to right. Keep node controls and wires unchanged.',
    {
      projectId,
      expectedRevision: revision,
      columnGap: z.number().min(280).max(800).default(360),
      rowGap: z.number().min(200).max(800).default(300),
    },
    async ({ projectId, expectedRevision, columnGap, rowGap }) => {
      const p = structuredClone(workspace.project(projectId)),
        depth = new Map(),
        pending = [...p.graph.nodes];
      while (pending.length) {
        const index = pending.findIndex((n) =>
          p.graph.connections
            .filter((c) => c.toNodeId === n.id)
            .every((c) => depth.has(c.fromNodeId)),
        );
        if (index < 0) throw Error('Cannot lay out a cycle');
        const [n] = pending.splice(index, 1),
          parents = p.graph.connections.filter((c) => c.toNodeId === n.id);
        depth.set(
          n.id,
          parents.length
            ? Math.max(...parents.map((c) => depth.get(c.fromNodeId))) + 1
            : 0,
        );
      }
      const rows = new Map();
      for (const n of p.graph.nodes) {
        const layer = depth.get(n.id),
          row = rows.get(layer) || 0;
        n.x = layer * columnGap;
        n.y = row;
        rows.set(
          layer,
          row +
            Math.max(
              rowGap,
              core.getNodeMinDimensions(
                n,
                workspace
                  .definitions(p)
                  .find((d) => d.id === (n.definitionId || n.type)),
              ).minHeight + 48,
            ),
        );
      }
      return commit(projectId, p, expectedRevision);
    },
  );
  tool(
    'group_create',
    'Frame two or more existing nodes as a named visual collection; calculations remain separate.',
    {
      projectId,
      expectedRevision: revision,
      name: z.string().min(1).max(100),
      nodeIds: z.array(id).min(2).max(2000),
    },
    async ({ projectId, expectedRevision, name, nodeIds }) => {
      const p = structuredClone(workspace.project(projectId)),
        selected = p.graph.nodes.filter((n) => nodeIds.includes(n.id));
      if (selected.length !== new Set(nodeIds).size)
        throw Error('Unknown selected node');
      const minX = Math.min(...selected.map((n) => n.x)),
        minY = Math.min(...selected.map((n) => n.y)),
        maxX = Math.max(...selected.map((n) => n.x + (n.width || 300))),
        maxY = Math.max(
          ...selected.map(
            (n) =>
              n.y +
              core.getNodeMinDimensions(
                n,
                workspace
                  .definitions(p)
                  .find((d) => d.id === (n.definitionId || n.type)),
              ).minHeight,
          ),
        );
      const frame = {
        id: randomUUID(),
        title: name,
        nodeIds: [...new Set(nodeIds)],
        x: minX - 30,
        y: minY - 55,
        width: maxX - minX + 60,
        height: maxY - minY + 85,
        color: '#4B5563',
      };
      p.graph.frames.push(frame);
      return {
        ...(await commit(projectId, p, expectedRevision)),
        frameId: frame.id,
      };
    },
  );
  tool(
    'group_remove',
    'Remove a visual frame while retaining its nodes and wires.',
    { projectId, expectedRevision: revision, frameId: id },
    async ({ projectId, expectedRevision, frameId }) => {
      const p = structuredClone(workspace.project(projectId));
      if (!p.graph.frames.some((f) => f.id === frameId))
        throw Error('Unknown frame');
      p.graph.frames = p.graph.frames.filter((f) => f.id !== frameId);
      return commit(projectId, p, expectedRevision);
    },
  );
  tool(
    'prefab_create',
    'Convert a working selection into one reusable node and install its definition. Value nodes become exposed input ports; Output nodes and outgoing boundary wires become output ports. Requires complete input-to-output paths and at least two nodes. Internal connections and dependencies are retained.',
    {
      projectId,
      expectedRevision: revision,
      name: z.string().min(1).max(100),
      nodeIds: z.array(id).min(2).max(2000),
    },
    async ({ projectId, expectedRevision, name, nodeIds }) => {
      liveEditable(projectId);
      const p = structuredClone(workspace.project(projectId));
      if (expectedRevision !== undefined && p.revision !== expectedRevision)
        throw Error('Revision conflict');
      const definition = core.createCompositeDefinition(
        p.graph,
        nodeIds,
        workspace.definitions(p),
        name,
      );
      Object.assign(
        p.graph,
        core.replaceSelectionWithComposite(p.graph, nodeIds, definition),
      );
      p.definitions = [...p.definitions, definition];
      const saved = await commit(projectId, p, expectedRevision);
      await workspace.install(definition);
      return { ...saved, definition };
    },
  );
  tool(
    'prefab_inspect',
    'Read a composite graph and its port-to-internal-node bindings.',
    { definitionId: id, projectId: projectId.optional() },
    ({ definitionId, projectId }) => {
      const d = workspace
        .definitions(projectId ? workspace.project(projectId) : null)
        .find((d) => d.id === definitionId);
      if (!d?.composite) throw Error('Definition is not a prefab');
      return { definition: d };
    },
    true,
  );
  tool(
    'prefab_unpack',
    'Restore a prefab instance as editable internal nodes. Preserves instance defaults and rewires external inputs and outputs. Keeps the reusable definition installed.',
    { projectId, expectedRevision: revision, nodeId: id },
    async ({ projectId, expectedRevision, nodeId }) => {
      const p = structuredClone(workspace.project(projectId)),
        node = p.graph.nodes.find((n) => n.id === nodeId);
      if (!node) throw Error('Unknown node');
      const definition = workspace
        .definitions(p)
        .find((d) => d.id === (node.definitionId || node.type));
      if (!definition?.composite) throw Error('Node is not a prefab');
      Object.assign(p.graph, core.unpackComposite(p.graph, nodeId, definition));
      return commit(projectId, p, expectedRevision);
    },
  );
  tool(
    'graph_history',
    'Undo or redo the last graph transaction. History is capped at 50 and lasts for this server session.',
    {
      projectId,
      direction: z.enum(['undo', 'redo']),
      expectedRevision: revision,
    },
    async ({ projectId, direction, expectedRevision }) => {
      liveEditable(projectId);
      const p = workspace.project(projectId),
        h = workspace.histories.get(projectId);
      if (!h?.[direction].length) throw Error('No history in this direction');
      const target = h[direction].at(-1),
        next = await workspace.commit(
          projectId,
          structuredClone(target),
          expectedRevision,
          false,
        );
      h[direction].pop();
      h[direction === 'undo' ? 'redo' : 'undo'].push(structuredClone(p));
      if (bridge.state.boundProjectId === projectId && bridge.connected())
        bridge.push(next, workspace.definitions(next), snapshot(next).folders);
      return clean(next);
    },
  );
  tool(
    'graph_execute',
    'Execute all nodes in an isolated worker with a 3-second deadline. Returns every node output, LaTeX, error provenance, and nested prefab evaluation. Custom code runs with Node.js privileges; use only trusted kernels. Does not mutate the saved graph.',
    { projectId },
    async ({ projectId }, extra) => {
      const p = workspace.project(projectId);
      if (extra.signal.aborted) throw Error('Cancelled');
      return await new Promise((yes, no) => {
        const w = new Worker(new URL('./execute-worker.mjs', import.meta.url), {
          workerData: {
            coreUrl,
            nodes: p.graph.nodes,
            connections: p.graph.connections,
            definitions: workspace.definitions(p),
          },
          stdout: true,
          stderr: true,
          resourceLimits: { maxOldGenerationSizeMb: 256 },
        });
        w.stdout.on('data', () => {});
        w.stderr.on('data', () => {});
        const finish = () => {
          clearTimeout(timer);
          extra.signal.removeEventListener('abort', cancel);
          w.terminate();
        };
        const cancel = () => {
          finish();
          no(Error('Execution cancelled'));
        };
        const timer = setTimeout(() => {
          finish();
          no(Error('Graph exceeded the 3 second execution deadline'));
        }, 3000);
        extra.signal.addEventListener('abort', cancel, { once: true });
        w.once('message', (m) => {
          finish();
          m.ok
            ? yes({ projectId, revision: p.revision, ...m.result })
            : no(Error(m.error));
        });
        w.once('error', (e) => {
          finish();
          no(e);
        });
        w.once('exit', (code) => {
          if (code !== 0) {
            finish();
            no(Error('Execution worker exited'));
          }
        });
      });
    },
  );
  tool(
    'live_status',
    'Inspect the optional loopback browser bridge. Use Settings > General > Enable MCP connection in MathNode.',
    {},
    () => ({ port, ...bridge.status() }),
    true,
  );
  tool(
    'live_pull',
    'Copy the currently visible browser graph and installed definitions into an MCP project. Refresh an existing project to resolve a live edit conflict. Subsequent mutations to this bound project automatically queue a canvas update.',
    { projectId: projectId.optional() },
    async ({ projectId }) => {
      if (!bridge.connected()) throw Error('No live app connected');
      if (bridge.state.pending)
        throw Error('Wait for the pending canvas update before pulling');
      const source = bridge.state.snapshot,
        definitions = source.definitions.map((d) =>
          core.validateNode(JSON.stringify(d)),
        );
      let p;
      if (projectId) {
        const current = workspace.project(projectId);
        p = await workspace.commit(
          projectId,
          { ...current, graph: source.graph, definitions },
          current.revision,
        );
      } else
        p = await workspace.create(
          source.graph.title || 'Live Canvas',
          source.graph,
          definitions,
          true,
        );
      bridge.state.boundProjectId = p.id;
      bridge.state.synchronizedHash = bridge.state.hash;
      bridge.state.error = null;
      bridge.state.conflicted = false;
      return clean(p);
    },
  );
  tool(
    'live_push',
    'Show an MCP project in the connected browser. Opens a new tab if this project is not already open. Returns queued status; poll live_status until appliedRevision matches. This explicitly replaces the matching project tab.',
    { projectId },
    ({ projectId }) => {
      const p = workspace.project(projectId);
      return bridge.push(p, workspace.definitions(p), snapshot(p).folders);
    },
  );
  const docRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  server.registerResource(
    'agent-guide',
    'mathnode://agent-guide',
    { mimeType: 'text/markdown' },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/markdown',
          text: await readFile(
            join(docRoot, 'docs/MCP_AGENT_GUIDE.md'),
            'utf8',
          ),
        },
      ],
    }),
  );
  server.registerResource(
    'node-authoring',
    'mathnode://node-authoring',
    { mimeType: 'text/markdown' },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/markdown',
          text: await readFile(join(docRoot, 'docs/NODE_AUTHORING.md'), 'utf8'),
        },
      ],
    }),
  );
  server.registerResource(
    'library',
    'mathnode://library',
    { mimeType: 'application/json' },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(
            workspace.definitions().map((d) => ({
              id: d.id,
              name: d.name,
              description: d.description,
            })),
          ),
        },
      ],
    }),
  );
  for (const [name, prompt] of [
    [
      'solve-math',
      'Build an inspectable step-by-step mathematical DAG, execute it, and explain intermediate results. Keep symbolic names using Value nodes; verify numerical bindings and errors.',
    ],
    [
      'create-prefab',
      'Find or create the requested graph, execute it, then make a reusable prefab from a valid selection. Inspect the exposed ports and export the .mnode.',
    ],
    [
      'author-node',
      'Search the library first. Prefer composing existing nodes. If code is needed, read mathnode://node-authoring, install a schema-valid symbolic-aware kernel, and test normal and domain-error examples.',
    ],
  ])
    server.registerPrompt(
      name,
      { description: prompt, argsSchema: { request: z.string() } },
      ({ request }) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `${prompt}\nUser request: ${request}\nRead mathnode://agent-guide before making changes.`,
            },
          },
        ],
      }),
    );
  const originalClose = server.close.bind(server);
  server.close = async () => {
    if (port !== null) await bridge.close();
    await originalClose();
  };
  await server.connect(transport);
  return { server, workspace, bridge };
}
