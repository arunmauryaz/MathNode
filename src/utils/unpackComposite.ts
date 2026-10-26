import {
  GraphSnapshot,
  NodeDefinition,
  NodeConnection,
  MathNodeInstance,
} from '../types';
/** Restore a prefab's graph while preserving external wires and instance controls. */
export function unpackComposite(
  graph: GraphSnapshot,
  nodeId: string,
  definition: NodeDefinition,
): GraphSnapshot {
  const instance = graph.nodes.find((n) => n.id === nodeId),
    body = definition.composite;
  if (!instance || !body) throw new Error('Select a prefab instance to unpack');
  const map = new Map(body.nodes.map((n) => [n.id, crypto.randomUUID()]));
  let nodes: MathNodeInstance[] = body.nodes.map((n) => ({
    ...structuredClone(n),
    id: map.get(n.id)!,
    x: n.x + instance.x,
    y: n.y + instance.y,
    computedOutputs: undefined,
    error: undefined,
    computedGraph: undefined,
  }));
  let connections: NodeConnection[] = body.connections.map((c) => ({
    ...c,
    id: crypto.randomUUID(),
    fromNodeId: map.get(c.fromNodeId)!,
    toNodeId: map.get(c.toNodeId)!,
  }));
  const overrides = new Map<string, { nodeId: string; socket: string }>();
  for (const binding of body.inputs) {
    const targetId = map.get(binding.nodeId)!,
      incoming = graph.connections.find(
        (c) => c.toNodeId === nodeId && c.toSocket === binding.name,
      ),
      target = nodes.find((n) => n.id === targetId)!;
    const fallback =
      instance.values?.[binding.name] ??
      definition.inputs.find((s) => s.name === binding.name)?.default;
    if (binding.mode === 'input') {
      if (incoming)
        connections.push({
          id: crypto.randomUUID(),
          fromNodeId: incoming.fromNodeId,
          fromSocket: incoming.fromSocket,
          toNodeId: targetId,
          toSocket: binding.socket,
        });
      else target.values = { ...target.values, [binding.socket]: fallback };
    } else {
      if ((target.definitionId || target.type) !== 'math.value')
        throw new Error('Only Value source overrides can be unpacked');
      if (incoming) {
        overrides.set(targetId, {
          nodeId: incoming.fromNodeId,
          socket: incoming.fromSocket,
        });
        nodes = nodes.filter((n) => n.id !== targetId);
      } else {
        const bindingValue = definition.inputs.find(
          (s) => s.name === binding.name,
        )?.defaultBinding;
        target.values = {
          ...target.values,
          value: fallback,
          assigned: bindingValue !== undefined,
          binding: bindingValue,
        };
      }
    }
  }
  const source = (
    id: string,
    socket: string,
  ): { nodeId: string; socket: string } =>
    overrides.get(id) || { nodeId: id, socket };
  connections = connections.map((c) => {
    const s = source(c.fromNodeId, c.fromSocket);
    return { ...c, fromNodeId: s.nodeId, fromSocket: s.socket };
  });
  for (const outgoing of graph.connections.filter(
    (c) => c.fromNodeId === nodeId,
  )) {
    const binding = body.outputs.find((b) => b.name === outgoing.fromSocket);
    if (!binding) throw new Error('Missing prefab output binding');
    const internal = body.nodes.find((n) => n.id === binding.nodeId)!;
    let s = source(map.get(binding.nodeId)!, binding.socket);
    if (
      (internal.definitionId || internal.type) === 'math.output' &&
      binding.socket === 'output'
    ) {
      const c = connections.find(
        (c) => c.toNodeId === map.get(binding.nodeId) && c.toSocket === 'input',
      );
      if (!c) throw new Error('Output node has no input to unpack');
      s = source(c.fromNodeId, c.fromSocket);
    }
    connections.push({
      ...outgoing,
      fromNodeId: s.nodeId,
      fromSocket: s.socket,
    });
  }
  const allIds = nodes.map((n) => n.id);
  return {
    nodes: [...graph.nodes.filter((n) => n.id !== nodeId), ...nodes],
    connections: [
      ...graph.connections.filter(
        (c) => c.fromNodeId !== nodeId && c.toNodeId !== nodeId,
      ),
      ...connections,
    ],
    frames: [
      ...(graph.frames || []).map((f) => ({
        ...f,
        nodeIds: f.nodeIds?.flatMap((id) => (id === nodeId ? allIds : [id])),
      })),
      ...(body.frames || []).map((f) => ({
        ...f,
        id: crypto.randomUUID(),
        x: f.x + instance.x,
        y: f.y + instance.y,
        nodeIds: f.nodeIds
          ?.map((id) => map.get(id)!)
          .filter((id) => allIds.includes(id)),
      })),
    ],
  };
}
