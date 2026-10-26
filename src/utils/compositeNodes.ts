import { connectionError } from './graphRules';
import {
  CompositeBinding,
  GraphSnapshot,
  MathNodeInstance,
  NodeConnection,
  NodeDefinition,
  NodeSocketDef,
} from '../types';
import { getNodeMinDimensions } from './socketGeometry';
export const MY_NODES_FOLDER = {
  id: 'folder-my-nodes',
  name: 'My Nodes',
  parentId: null,
};
const key = (node: string, socket: string) => JSON.stringify([node, socket]);
export function cleanInstance(node: MathNodeInstance): MathNodeInstance {
  const {
    computedOutputs: _outputs,
    error: _error,
    errorKind: _kind,
    errorSourceNodeId: _source,
    errorConnectionIds: _connections,
    computedGraph: _graph,
    ...rest
  } = node;
  return structuredClone(rest);
}
function assertAcyclic(graph: GraphSnapshot) {
  const degree = new Map(graph.nodes.map((n) => [n.id, 0]));
  const adj = new Map(graph.nodes.map((n) => [n.id, [] as string[]]));
  for (const c of graph.connections) {
    degree.set(c.toNodeId, (degree.get(c.toNodeId) || 0) + 1);
    adj.get(c.fromNodeId)?.push(c.toNodeId);
  }
  const queue = [...degree].filter(([, d]) => d === 0).map(([id]) => id);
  for (let i = 0; i < queue.length; i++)
    for (const next of adj.get(queue[i]) || []) {
      degree.set(next, degree.get(next)! - 1);
      if (degree.get(next) === 0) queue.push(next);
    }
  if (queue.length !== graph.nodes.length)
    throw new Error('Remove cycles before making a reusable node');
}
export function createCompositeDefinition(
  graph: GraphSnapshot,
  ids: string[],
  definitions: NodeDefinition[],
  name: string,
): NodeDefinition {
  if (!name.trim()) throw new Error('Enter a name for the node');
  const selected = graph.nodes.filter((n) => ids.includes(n.id));
  if (selected.length < 2)
    throw new Error('Select at least two nodes to make a reusable node');
  const set = new Set(selected.map((n) => n.id)),
    defMap = new Map(definitions.map((d) => [d.id, d]));
  for (const node of selected)
    if (!defMap.has(node.definitionId || node.type))
      throw new Error(`Install the missing definition for ${node.title} first`);
  const internal = graph.connections.filter(
    (c) => set.has(c.fromNodeId) && set.has(c.toNodeId),
  );
  assertAcyclic({ nodes: selected, connections: internal });
  for (const connection of internal) {
    const error = connectionError(connection, selected, internal, definitions);
    if (error) throw new Error(error);
  }
  const inputs: NodeSocketDef[] = [],
    outputs: NodeSocketDef[] = [],
    inBindings: CompositeBinding[] = [],
    outBindings: CompositeBinding[] = [];
  const inputMap = new Map<string, string>(),
    outputMap = new Map<string, string>();
  const unique = (list: NodeSocketDef[], title: string) => {
    const base =
      title
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'port';
    let candidate = base,
      index = 2;
    while (list.some((s) => s.name === candidate))
      candidate = `${base}_${index++}`;
    return candidate;
  };
  const addInput = (
    node: MathNodeInstance,
    socket: string,
    mode: 'input' | 'output',
    spec: NodeSocketDef,
    label: string,
    value: unknown,
  ) => {
    const mapKey = key(node.id, socket);
    if (inputMap.has(mapKey)) return inputMap.get(mapKey)!;
    const originalLabel = label;
    let labelIndex = 2;
    while (inputs.some((s) => s.label === label))
      label = `${originalLabel} ${labelIndex++}`;
    const portName = unique(inputs, label);
    const defaultValue =
      typeof value === 'number' ||
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      Array.isArray(value)
        ? (structuredClone(value) as NodeSocketDef['default'])
        : spec.default;
    inputs.push({
      ...structuredClone(spec),
      name: portName,
      label,
      default: defaultValue,
      defaultBinding:
        mode === 'output' &&
        node.values?.assigned &&
        typeof node.values?.binding === 'number'
          ? node.values.binding
          : spec.defaultBinding,
      connectable: true,
      enabledWhen: undefined,
      widget:
        spec.type === 'scalar' || spec.type === 'int' || spec.type === 'any'
          ? 'number'
          : spec.widget,
    });
    inBindings.push({ name: portName, nodeId: node.id, socket, mode });
    inputMap.set(mapKey, portName);
    return portName;
  };
  const addOutput = (
    node: MathNodeInstance,
    socket: string,
    spec: NodeSocketDef,
    label: string,
  ) => {
    const mapKey = key(node.id, socket);
    if (outputMap.has(mapKey)) return outputMap.get(mapKey)!;
    const originalLabel = label;
    let labelIndex = 2;
    while (outputs.some((s) => s.label === label))
      label = `${originalLabel} ${labelIndex++}`;
    const portName = unique(outputs, label);
    outputs.push({
      name: portName,
      label,
      type: spec.type,
      description: spec.description,
    });
    outBindings.push({
      name: portName,
      nodeId: node.id,
      socket,
      mode: 'output',
    });
    outputMap.set(mapKey, portName);
    return portName;
  };
  for (const node of selected.filter(
    (n) => (n.definitionId || n.type) === 'math.value',
  )) {
    const spec = defMap
      .get(node.definitionId || node.type)!
      .outputs.find((s) => s.name === 'value')!;
    addInput(
      node,
      'value',
      'output',
      spec,
      node.title || 'Value',
      node.values?.value ?? 10,
    );
  }
  for (const connection of graph.connections.filter(
    (c) => !set.has(c.fromNodeId) && set.has(c.toNodeId),
  )) {
    const node = selected.find((n) => n.id === connection.toNodeId)!;
    const spec = defMap
      .get(node.definitionId || node.type)!
      .inputs.find(
        (s) => s.name === connection.toSocket && s.connectable !== false,
      );
    if (!spec) throw new Error('A selection has an invalid incoming socket');
    addInput(
      node,
      spec.name,
      'input',
      spec,
      `${node.title} ${spec.label || spec.name}`,
      node.values?.[spec.name] ?? spec.default,
    );
  }
  for (const node of selected.filter(
    (n) => (n.definitionId || n.type) === 'math.output',
  )) {
    const incoming = internal.find(
      (c) => c.toNodeId === node.id && c.toSocket === 'input',
    );
    const source = selected.find((n) => n.id === incoming?.fromNodeId);
    const spec = defMap
      .get(source?.definitionId || source?.type || '')
      ?.outputs.find((s) => s.name === incoming?.fromSocket) || {
      name: 'output',
      type: 'any' as const,
    };
    const portName = addOutput(node, 'output', spec, node.title || 'Result');
    if (incoming)
      outputMap.set(key(incoming.fromNodeId, incoming.fromSocket), portName);
  }
  for (const c of graph.connections.filter(
    (c) => set.has(c.fromNodeId) && !set.has(c.toNodeId),
  )) {
    const node = selected.find((n) => n.id === c.fromNodeId)!;
    const spec = defMap
      .get(node.definitionId || node.type)!
      .outputs.find((s) => s.name === c.fromSocket && s.connectable !== false);
    if (!spec) throw new Error('A selection has an invalid outgoing socket');
    addOutput(
      node,
      spec.name,
      spec,
      `${node.title} ${spec.label || spec.name}`,
    );
  }
  if (!inputs.length)
    throw new Error(
      'Include a Value node or an incoming connection as an input',
    );
  if (!outputs.length)
    throw new Error(
      'Include a connected View Result node or an outgoing connection as an output',
    );
  const reachable = (start: string) => {
    const visited = new Set<string>(),
      queue = [start];
    while (queue.length) {
      const id = queue.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      for (const c of internal) if (c.fromNodeId === id) queue.push(c.toNodeId);
    }
    return visited;
  };
  const routes = new Map(selected.map((n) => [n.id, reachable(n.id)]));
  for (const input of inBindings)
    if (
      !outBindings.some((output) =>
        routes.get(input.nodeId)!.has(output.nodeId),
      )
    )
      throw new Error(
        'Connect every exposed input to an output before making a node',
      );
  for (const output of outBindings)
    if (
      !inBindings.some((input) => routes.get(input.nodeId)!.has(output.nodeId))
    )
      throw new Error(
        'Connect every output to the selected inputs before making a node',
      );
  for (const node of selected)
    if (!outBindings.some((output) => routes.get(node.id)!.has(output.nodeId)))
      throw new Error(`Remove or connect the unused node "${node.title}"`);
  const minX = Math.min(...selected.map((n) => n.x)),
    minY = Math.min(...selected.map((n) => n.y));
  const embedded = [
    ...new Set(selected.map((n) => n.definitionId || n.type)),
  ].map((id) => {
    const { folderId: _folder, ...def } = defMap.get(id)!;
    return structuredClone(def);
  });
  return {
    id: `user.${crypto.randomUUID()}`,
    name: name.trim(),
    category: 'My Nodes',
    folderId: MY_NODES_FOLDER.id,
    icon: 'function',
    badge: 'CREATED',
    description: `Reusable graph with ${selected.length} internal nodes`,
    inputs,
    outputs,
    composite: {
      version: 1,
      nodes: selected.map((n) => ({
        ...cleanInstance(n),
        x: n.x - minX,
        y: n.y - minY,
      })),
      connections: structuredClone(internal),
      frames: (graph.frames || [])
        .filter(
          (f) => f.nodeIds?.length && f.nodeIds.every((id) => set.has(id)),
        )
        .map((f) => ({ ...structuredClone(f), x: f.x - minX, y: f.y - minY })),
      definitions: embedded,
      inputs: inBindings,
      outputs: outBindings,
    },
  };
}
export function replaceSelectionWithComposite(
  graph: GraphSnapshot,
  ids: string[],
  definition: NodeDefinition,
  instanceId = crypto.randomUUID(),
): GraphSnapshot {
  const body = definition.composite;
  if (!body) throw new Error('Missing internal graph');
  const selected = graph.nodes.filter((n) => ids.includes(n.id)),
    selectedIds = new Set(ids);
  if (selected.length !== body.nodes.length)
    throw new Error('The selection changed; reopen Make Node');
  const inputFor = (id: string, socket: string) =>
    body.inputs.find(
      (b) => b.nodeId === id && b.socket === socket && b.mode === 'input',
    )?.name;
  const outputFor = (id: string, socket: string) =>
    body.outputs.find((b) => b.nodeId === id && b.socket === socket)?.name ||
    body.outputs.find((b) => {
      if (
        (body.nodes.find((n) => n.id === b.nodeId)?.definitionId ||
          body.nodes.find((n) => n.id === b.nodeId)?.type) !== 'math.output'
      )
        return false;
      return body.connections.some(
        (c) =>
          c.fromNodeId === id &&
          c.fromSocket === socket &&
          c.toNodeId === b.nodeId &&
          c.toSocket === 'input',
      );
    })?.name;
  const connections: NodeConnection[] = [];
  for (const c of graph.connections) {
    const from = selectedIds.has(c.fromNodeId),
      to = selectedIds.has(c.toNodeId);
    if (from && to) continue;
    if (to) {
      const port = inputFor(c.toNodeId, c.toSocket);
      if (!port) throw new Error('An incoming connection cannot be mapped');
      connections.push({ ...c, toNodeId: instanceId, toSocket: port });
    } else if (from) {
      const port = outputFor(c.fromNodeId, c.fromSocket);
      if (!port) throw new Error('An outgoing connection cannot be mapped');
      connections.push({ ...c, fromNodeId: instanceId, fromSocket: port });
    } else connections.push(c);
  }
  const node: MathNodeInstance = {
    id: instanceId,
    type: definition.id,
    definitionId: definition.id,
    title: definition.name,
    x: Math.min(...selected.map((n) => n.x)),
    y: Math.min(...selected.map((n) => n.y)),
    values: Object.fromEntries(
      definition.inputs.map((s) => [s.name, structuredClone(s.default ?? 0)]),
    ),
  };
  const dimensions = getNodeMinDimensions(node, definition);
  node.width = dimensions.minWidth;
  node.height = dimensions.minHeight;
  const result: GraphSnapshot = {
    nodes: [...graph.nodes.filter((n) => !selectedIds.has(n.id)), node],
    connections,
    frames: graph.frames
      ?.map((f) => ({
        ...f,
        nodeIds: f.nodeIds?.some((id) => selectedIds.has(id))
          ? [
              ...new Set([
                ...f.nodeIds.filter((id) => !selectedIds.has(id)),
                instanceId,
              ]),
            ]
          : f.nodeIds,
      }))
      .filter(
        (f) =>
          !f.nodeIds?.length ||
          !body.frames?.some((saved) => saved.id === f.id),
      ),
  };
  assertAcyclic(result);
  return result;
}
export function exportMNode(definition: NodeDefinition): string {
  const { folderId: _folder, ...portable } = definition;
  return JSON.stringify(portable, null, 2);
}
export function downloadMNode(definition: NodeDefinition): void {
  const url = URL.createObjectURL(
    new Blob([exportMNode(definition)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `${definition.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') || 'Created Node'}.mnode`;
  link.click();
  URL.revokeObjectURL(url);
}
