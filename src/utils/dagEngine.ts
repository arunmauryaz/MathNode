import {
  isSymbolic,
  isEquation,
  kernelMath,
  validateMath,
} from './symbolicMath';
import {
  MathNodeInstance,
  NodeConnection,
  NodeDefinition,
  DataType,
  GraphSnapshot,
} from '../types';
import { compatibleTypes } from './graphRules';
export interface ExecutionResult {
  updatedNodes: MathNodeInstance[];
  errors: Record<string, string | null>;
}
const kernels = new Map<
  string,
  (inputs: Record<string, unknown>, math: Math) => unknown
>();
const results = new Map<
  string,
  {
    key: string;
    outputs: Record<string, unknown>;
    error: string | null;
    graph?: GraphSnapshot;
  }
>();
function validValue(value: unknown, type?: DataType): boolean {
  if (isSymbolic(value) || isEquation(value)) {
    validateMath(value);
    return true;
  }
  if (typeof value === 'number')
    return (
      Number.isFinite(value) && (type !== 'int' || Number.isInteger(value))
    );
  if (Array.isArray(value))
    return value.length > 0 && value.every((v) => validValue(v));
  return typeof value === 'string' || typeof value === 'boolean';
}
function matchesType(value: unknown, type: DataType): boolean {
  if (!validValue(value, type)) return false;
  if (type === 'any') return true;
  if (type === 'equation') return isEquation(value);
  if (type === 'scalar') return typeof value === 'number' || isSymbolic(value);
  if (type === 'int') return typeof value === 'number';
  if (type === 'bool') return typeof value === 'boolean';
  if (type === 'string' || type === 'calculus')
    return typeof value === 'string';
  if (type === 'vector')
    return Array.isArray(value) && value.every((v) => typeof v === 'number');
  return (
    Array.isArray(value) &&
    value.every(
      (row) =>
        Array.isArray(row) &&
        row.length === value[0].length &&
        row.every((v) => typeof v === 'number'),
    )
  );
}
export function executeMathGraph(
  nodes: MathNodeInstance[],
  connections: NodeConnection[],
  definitions: NodeDefinition[],
  context: {
    scope: string;
    depth: number;
    stack: string[];
    overrides?: Map<
      string,
      { inputs: Record<string, unknown>; outputs: Record<string, unknown> }
    >;
  } = { scope: 'root', depth: 0, stack: [] },
): ExecutionResult {
  if (context.depth > 12) throw new Error('Reusable node nesting is too deep');
  const defs = new Map(definitions.map((d) => [d.id, d]));
  const nodeMap = new Map(
    nodes.map((n) => [
      n.id,
      {
        ...n,
        computedOutputs: {} as Record<string, unknown>,
        error: null as string | null,
        errorKind: undefined as MathNodeInstance['errorKind'],
        errorSourceNodeId: undefined as string | undefined,
        errorConnectionIds: [] as string[],
        computedGraph: undefined as GraphSnapshot | undefined,
      },
    ]),
  );
  const incoming = new Map(nodes.map((n) => [n.id, [] as NodeConnection[]]));
  const adjacency = new Map(nodes.map((n) => [n.id, [] as string[]]));
  const degree = new Map(nodes.map((n) => [n.id, 0]));
  for (const c of connections) {
    if (!nodeMap.has(c.fromNodeId) || !nodeMap.has(c.toNodeId)) {
      if (nodeMap.has(c.toNodeId)) {
        const target = nodeMap.get(c.toNodeId)!;
        target.error = 'Connection references a missing node';
        target.errorKind = 'connection';
        target.errorSourceNodeId = target.id;
        target.errorConnectionIds.push(c.id);
      }
      continue;
    }
    incoming.get(c.toNodeId)!.push(c);
    adjacency.get(c.fromNodeId)!.push(c.toNodeId);
    degree.set(c.toNodeId, degree.get(c.toNodeId)! + 1);
  }
  const queue = nodes.filter((n) => degree.get(n.id) === 0).map((n) => n.id);
  const visited = new Set<string>();
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index];
    visited.add(id);
    const node = nodeMap.get(id)!;
    const def = defs.get(node.definitionId || node.type);
    try {
      if (node.error) throw new Error(node.error);
      if (!def)
        throw new Error(
          `Missing node definition: ${node.definitionId || node.type}`,
        );
      const inputs: Record<string, unknown> = structuredClone(
        node.values || {},
      );
      for (const s of def.inputs)
        if (inputs[s.name] === undefined && s.default !== undefined)
          inputs[s.name] = structuredClone(s.default);
      const overrides = context.overrides?.get(id);
      Object.assign(inputs, structuredClone(overrides?.inputs || {}));
      if (overrides?.inputs && Object.keys(overrides.inputs).length)
        node.values = { ...node.values, ...structuredClone(overrides.inputs) };
      const wired = new Set<string>();
      for (const c of incoming.get(id)!) {
        const source = nodeMap.get(c.fromNodeId)!;
        if (source.error) {
          node.errorKind = 'upstream';
          node.errorSourceNodeId = source.errorSourceNodeId || source.id;
          node.errorConnectionIds.push(c.id);
          const root = nodeMap.get(node.errorSourceNodeId) || source;
          throw new Error(`Upstream error: ${root.title}: ${root.error}`);
        }
        const output = defs
          .get(source.definitionId || source.type)
          ?.outputs.find(
            (s) => s.name === c.fromSocket && s.connectable !== false,
          );
        const input = def.inputs.find(
          (s) => s.name === c.toSocket && s.connectable !== false,
        );
        if (!output || !input) {
          node.errorKind = 'connection';
          node.errorConnectionIds.push(c.id);
          throw new Error('Connection references a missing socket');
        }
        if (!compatibleTypes(output.type, input.type)) {
          node.errorKind = 'connection';
          node.errorConnectionIds.push(c.id);
          throw new Error(
            `Incompatible connection: ${output.type} to ${input.type}`,
          );
        }
        if (wired.has(input.name)) {
          node.errorKind = 'connection';
          node.errorConnectionIds.push(
            ...incoming
              .get(id)!
              .filter((w) => w.toSocket === input.name)
              .map((w) => w.id),
          );
          throw new Error(`Multiple connections to ${input.name}`);
        }
        wired.add(input.name);
        if (source.computedOutputs[c.fromSocket] === undefined) {
          node.errorKind = 'connection';
          node.errorConnectionIds.push(c.id);
          throw new Error(`Missing upstream output: ${c.fromSocket}`);
        }
        inputs[c.toSocket] = structuredClone(
          source.computedOutputs[c.fromSocket],
        );
      }
      for (const s of def.inputs)
        if (s.type === 'scalar' && typeof inputs[s.name] === 'string')
          inputs[s.name] = kernelMath.value(inputs[s.name], s.defaultBinding);
      for (const s of def.inputs)
        if (!matchesType(inputs[s.name], s.type))
          throw new Error(`Invalid ${s.type} input: ${s.name}`);
      const key = JSON.stringify([
        def.code,
        def.composite,
        def.inputs,
        def.outputs,
        inputs,
        overrides?.outputs,
      ]);
      const cacheId = JSON.stringify([context.scope, id]);
      const cached = results.get(cacheId);
      if (cached?.key === key) {
        node.computedOutputs = structuredClone(cached.outputs);
        node.error = cached.error;
        node.computedGraph = structuredClone(cached.graph);
      } else {
        let result: unknown = inputs;
        if (overrides && Object.keys(overrides.outputs).length) {
          result = structuredClone(overrides.outputs);
        } else if (def.composite) {
          if (context.stack.includes(def.id))
            throw new Error('Recursive reusable node definition');
          const internalOverrides = new Map<
            string,
            {
              inputs: Record<string, unknown>;
              outputs: Record<string, unknown>;
            }
          >();
          for (const binding of def.composite.inputs) {
            const override = internalOverrides.get(binding.nodeId) || {
              inputs: {},
              outputs: {},
            };
            (binding.mode === 'input' ? override.inputs : override.outputs)[
              binding.socket
            ] = inputs[binding.name];
            internalOverrides.set(binding.nodeId, override);
          }
          const evaluated = executeMathGraph(
            def.composite.nodes,
            def.composite.connections,
            def.composite.definitions,
            {
              scope: cacheId,
              depth: context.depth + 1,
              stack: [...context.stack, def.id],
              overrides: internalOverrides,
            },
          );
          node.computedGraph = {
            nodes: evaluated.updatedNodes,
            connections: def.composite.connections,
            frames: def.composite.frames,
          };
          const failed =
            evaluated.updatedNodes.find(
              (n) => n.error && n.errorKind !== 'upstream',
            ) || evaluated.updatedNodes.find((n) => n.error);
          if (failed)
            throw new Error(
              `Inside ${def.name}: ${failed.title}: ${failed.error}`,
            );
          result = Object.fromEntries(
            def.composite.outputs.map((binding) => {
              const source = evaluated.updatedNodes.find(
                (n) => n.id === binding.nodeId,
              );
              const value = source?.computedOutputs?.[binding.socket];
              if (value === undefined)
                throw new Error(`Missing internal result: ${binding.name}`);
              return [binding.name, value];
            }),
          );
          node.computedGraph = {
            nodes: evaluated.updatedNodes,
            connections: def.composite.connections,
            frames: def.composite.frames,
          };
        } else if (def.code?.trim()) {
          let fn = kernels.get(def.code);
          if (!fn) {
            try {
              fn = new Function(
                'inputs',
                'math',
                `"use strict"; const kernel = (${def.code}); if(typeof kernel !== 'function') throw new Error('Kernel must be a function'); return kernel(inputs, math);`,
              ) as (inputs: Record<string, unknown>, math: Math) => unknown;
            } catch (error) {
              if (!(error instanceof SyntaxError)) throw error;
              fn = new Function(
                'inputs',
                'math',
                `"use strict"; ${def.code}`,
              ) as (inputs: Record<string, unknown>, math: Math) => unknown;
            }
            kernels.set(def.code, fn);
          }
          result = fn!(inputs, kernelMath);
        }
        if (!result || typeof result !== 'object' || Array.isArray(result))
          throw new Error('Kernel must return an output object');
        const outputs = result as Record<string, unknown>;
        for (const s of def.outputs)
          if (!matchesType(outputs[s.name], s.type))
            throw new Error(
              `Invalid or non-finite ${s.type} output: ${s.name}`,
            );
        if (!Object.values(outputs).every((v) => validValue(v)))
          throw new Error('Kernel returned an invalid or non-finite result');
        node.computedOutputs = structuredClone(outputs);
        results.set(cacheId, {
          key,
          outputs: structuredClone(outputs),
          error: null,
          graph: structuredClone(node.computedGraph),
        });
      }
    } catch (error) {
      node.error = error instanceof Error ? error.message : String(error);
      node.errorKind ??= 'calculation';
      node.errorSourceNodeId ??= id;
      node.computedOutputs = {};
      results.delete(JSON.stringify([context.scope, id]));
    }
    for (const next of adjacency.get(id)!) {
      degree.set(next, degree.get(next)! - 1);
      if (degree.get(next) === 0) queue.push(next);
    }
  }
  for (const node of nodeMap.values())
    if (!visited.has(node.id)) {
      node.error = 'Cycle detected, or dependent on a cycle';
      node.errorKind = 'cycle';
      node.errorSourceNodeId = node.id;
      node.errorConnectionIds = incoming.get(node.id)!.map((c) => c.id);
      node.computedOutputs = {};
    }
  if (results.size > 4096) results.clear();
  if (kernels.size > 256) kernels.clear();
  return {
    updatedNodes: [...nodeMap.values()],
    errors: Object.fromEntries(
      [...nodeMap.values()].map((n) => [n.id, n.error]),
    ),
  };
}
