import { VALUE_DEFINITION } from './valueDefinition';
import { parseGraph } from './graphFile';
import { connectionError } from './graphRules';
import {
  CompositeBinding,
  CompositeNodeDefinition,
  NodeDefinition,
  NodeSocketDef,
} from '../types';
const types = new Set([
  'scalar',
  'vector',
  'matrix',
  'calculus',
  'bool',
  'int',
  'string',
  'any',
  'equation',
]);
const widgets = new Set([
  'number',
  'slider',
  'matrix2x2',
  'matrix4x4',
  'dropdown',
  'text',
  'toggle',
]);
export function parseMNode(
  content: string,
  targetFolderId: string | null = null,
  fileName?: string,
  depth = 0,
): NodeDefinition | null {
  try {
    if (depth > 12) return null;
    const data = JSON.parse(content);
    if (data?.id === 'math.variable' || data?.id === 'math.value')
      return { ...VALUE_DEFINITION, folderId: targetFolderId };
    if (
      !data ||
      typeof data !== 'object' ||
      (!data.name && !data.id) ||
      !Array.isArray(data.inputs) ||
      !Array.isArray(data.outputs)
    )
      return null;
    const validSockets = (sockets: NodeSocketDef[]) => {
      const names = new Set<string>();
      return sockets.every((s) => {
        if (
          !s ||
          typeof s.name !== 'string' ||
          !s.name ||
          names.has(s.name) ||
          !types.has(s.type) ||
          (s.widget && !widgets.has(s.widget))
        )
          return false;
        if (s.connectable !== undefined && typeof s.connectable !== 'boolean')
          return false;
        if (s.label !== undefined && typeof s.label !== 'string') return false;
        if (s.enabledWhen !== undefined && typeof s.enabledWhen !== 'string')
          return false;
        names.add(s.name);
        if (
          s.widget === 'dropdown' &&
          (!Array.isArray(s.options) ||
            !s.options.length ||
            !s.options.every((o) => typeof o === 'string'))
        )
          return false;
        return (
          [s.min, s.max, s.step, s.defaultBinding].every(
            (n) =>
              n === undefined || (typeof n === 'number' && Number.isFinite(n)),
          ) &&
          (s.step === undefined || s.step > 0) &&
          (s.min === undefined || s.max === undefined || s.min <= s.max)
        );
      });
    };
    if (
      !validSockets(data.inputs) ||
      !validSockets(data.outputs) ||
      (data.code !== undefined && typeof data.code !== 'string')
    )
      return null;
    let composite: CompositeNodeDefinition | undefined;
    if (data.composite !== undefined) {
      const body = data.composite;
      if (
        !body ||
        body.version !== 1 ||
        !Array.isArray(body.definitions) ||
        body.definitions.length > 2000 ||
        !Array.isArray(body.inputs) ||
        !Array.isArray(body.outputs)
      )
        return null;
      const graph = parseGraph(JSON.stringify(body));
      if (!graph.nodes?.length || graph.nodes.length > 2000) return null;
      if (
        new Set(body.definitions.map((d: NodeDefinition) => d.id)).size !==
        body.definitions.length
      )
        return null;
      const embedded = body.definitions.map((d: unknown) =>
        parseMNode(JSON.stringify(d), null, undefined, depth + 1),
      );
      if (embedded.some((d: NodeDefinition | null) => !d)) return null;
      const definitions = [
        ...new Map(
          (embedded as NodeDefinition[]).map((d) => [d.id, d]),
        ).values(),
      ];
      const defs = new Map(definitions.map((d) => [d.id, d]));
      if (
        defs.size !== definitions.length ||
        graph.nodes.some((n) => !defs.has(n.definitionId || n.type))
      )
        return null;
      if (
        graph.connections?.some((c) =>
          connectionError(c, graph.nodes!, graph.connections!, definitions),
        )
      )
        return null;
      const checkBindings = (
        list: CompositeBinding[],
        sockets: NodeSocketDef[],
        input: boolean,
      ) => {
        if (list.length !== sockets.length) return false;
        const used = new Set<string>();
        return list.every((b) => {
          if (
            !b ||
            typeof b.name !== 'string' ||
            used.has(b.name) ||
            !sockets.some((s) => s.name === b.name) ||
            typeof b.nodeId !== 'string' ||
            typeof b.socket !== 'string' ||
            !['input', 'output'].includes(b.mode)
          )
            return false;
          used.add(b.name);
          const node = graph.nodes!.find((n) => n.id === b.nodeId);
          const def = defs.get(node?.definitionId || node?.type || '');
          if (!node || !def || (!input && b.mode !== 'output')) return false;
          if (input)
            return (b.mode === 'input' ? def.inputs : def.outputs).some(
              (s) => s.name === b.socket && s.connectable !== false,
            );
          return (
            def.outputs.some(
              (s) => s.name === b.socket && s.connectable !== false,
            ) ||
            ((node.definitionId || node.type) === 'math.output' &&
              b.socket === 'output')
          );
        });
      };
      if (
        !checkBindings(body.inputs, data.inputs, true) ||
        !checkBindings(body.outputs, data.outputs, false) ||
        !data.outputs.length
      )
        return null;
      composite = {
        version: 1,
        nodes: graph.nodes,
        connections: graph.connections || [],
        frames: graph.frames,
        definitions,
        inputs: body.inputs,
        outputs: body.outputs,
      };
    }
    return {
      id:
        typeof data.id === 'string' && data.id ? data.id : crypto.randomUUID(),
      name:
        typeof data.name === 'string'
          ? data.name
          : fileName?.replace(/\.[^.]+$/, '') || 'Custom Node',
      folderId: targetFolderId,
      category: typeof data.category === 'string' ? data.category : 'General',
      badge: composite
        ? 'CREATED'
        : typeof data.badge === 'string'
          ? data.badge
          : 'KERNEL',
      icon: typeof data.icon === 'string' ? data.icon : 'function',
      description: typeof data.description === 'string' ? data.description : '',
      inputs: data.inputs,
      outputs: data.outputs,
      code: composite ? undefined : data.code || '',
      composite,
    };
  } catch {
    return null;
  }
}
