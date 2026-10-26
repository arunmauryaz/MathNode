import {
  MathGraph,
  MathNodeInstance,
  NodeConnection,
  MathFrame,
} from '../types';
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);
export function parseGraph(
  content: string,
  fileName = 'Imported Graph',
): MathGraph {
  const data: unknown = JSON.parse(content);
  if (
    !record(data) ||
    !Array.isArray(data.nodes) ||
    !Array.isArray(data.connections)
  )
    throw new Error('A workspace must contain nodes and connections arrays');
  const ids = new Set<string>();
  const nodes: MathNodeInstance[] = data.nodes.map((n: unknown) => {
    if (
      !record(n) ||
      typeof n.id !== 'string' ||
      !n.id ||
      ids.has(n.id) ||
      !finite(n.x) ||
      !finite(n.y) ||
      typeof (n.definitionId || n.type) !== 'string'
    )
      throw new Error('Invalid node or duplicate node ID');
    ids.add(n.id);
    const legacy = (n.definitionId || n.type) === 'math.variable';
    const oldValues = record(n.values) ? n.values : {};
    return {
      id: n.id,
      definitionId: String(legacy ? 'math.value' : n.definitionId || n.type),
      type: String(legacy ? 'math.value' : n.definitionId || n.type),
      title: typeof n.title === 'string' ? n.title : String(n.type),
      x: n.x,
      y: n.y,
      width: finite(n.width) && n.width > 0 ? n.width : undefined,
      height: finite(n.height) && n.height > 0 ? n.height : undefined,
      collapsed: n.collapsed === true,
      showAdvanced: n.showAdvanced === true,
      color:
        typeof n.color === 'string' && /^#[0-9a-f]{6}$/i.test(n.color)
          ? n.color
          : undefined,
      values: legacy
        ? {
            value: oldValues.name ?? 'A',
            assigned: oldValues.assigned ?? false,
            binding: oldValues.value ?? 0,
          }
        : oldValues,
      computedOutputs: {},
    };
  });
  const connIds = new Set<string>();
  const occupied = new Set<string>();
  const connections: NodeConnection[] = data.connections.map((c: unknown) => {
    if (
      !record(c) ||
      typeof c.id !== 'string' ||
      connIds.has(c.id) ||
      typeof c.fromNodeId !== 'string' ||
      typeof c.toNodeId !== 'string' ||
      !ids.has(c.fromNodeId) ||
      !ids.has(c.toNodeId) ||
      typeof c.fromSocket !== 'string' ||
      typeof c.toSocket !== 'string'
    )
      throw new Error('Invalid connection or duplicate connection ID');
    const input = JSON.stringify([c.toNodeId, c.toSocket]);
    if (occupied.has(input))
      throw new Error('An input cannot have multiple incoming connections');
    occupied.add(input);
    connIds.add(c.id);
    return {
      id: c.id,
      fromNodeId: c.fromNodeId,
      toNodeId: c.toNodeId,
      fromSocket: c.fromSocket,
      toSocket: c.toSocket,
    };
  });
  const frameIds = new Set<string>();
  const frames: MathFrame[] = Array.isArray(data.frames)
    ? data.frames.map((f: unknown) => {
        if (
          !record(f) ||
          typeof f.id !== 'string' ||
          frameIds.has(f.id) ||
          !finite(f.x) ||
          !finite(f.y) ||
          !finite(f.width) ||
          !finite(f.height) ||
          f.width <= 0 ||
          f.height <= 0
        )
          throw new Error('Invalid frame');
        frameIds.add(f.id);
        return {
          id: f.id,
          title: String(f.title || 'Frame'),
          color:
            typeof f.color === 'string' && /^#[0-9a-f]{6}$/i.test(f.color)
              ? f.color
              : '#4B5563',
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
          ...(Array.isArray(f.nodeIds)
            ? {
                nodeIds: [
                  ...new Set(
                    f.nodeIds.filter(
                      (id): id is string =>
                        typeof id === 'string' && ids.has(id),
                    ),
                  ),
                ],
              }
            : {}),
        };
      })
    : [];
  const pan =
    record(data.pan) && finite(data.pan.x) && finite(data.pan.y)
      ? { x: data.pan.x, y: data.pan.y }
      : { x: 0, y: 0 };
  return {
    id: typeof data.id === 'string' ? data.id : crypto.randomUUID(),
    title:
      typeof data.title === 'string'
        ? data.title
        : fileName.replace(/\.[^.]+$/, ''),
    lastEdited: 'Just now',
    category: typeof data.category === 'string' ? data.category : undefined,
    description:
      typeof data.description === 'string' ? data.description : undefined,
    isModified: false,
    nodes,
    connections,
    frames,
    pan,
    zoom: finite(data.zoom) ? Math.min(3, Math.max(0.2, data.zoom)) : 1,
  };
}
export function exportGraph(graph: MathGraph): string {
  return JSON.stringify(
    {
      version: 1,
      id: graph.id,
      title: graph.title,
      lastEdited: graph.lastEdited,
      category: graph.category,
      description: graph.description,
      pan: graph.pan,
      zoom: graph.zoom,
      nodes: graph.nodes?.map(
        ({
          computedOutputs: _outputs,
          error: _error,
          errorKind: _kind,
          errorSourceNodeId: _source,
          errorConnectionIds: _connections,
          computedGraph: _graph,
          ...node
        }) => node,
      ),
      connections: graph.connections || [],
      frames: graph.frames || [],
    },
    null,
    2,
  );
}
