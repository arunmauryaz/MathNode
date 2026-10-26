import { isSymbolic, isEquation, formatMath } from './symbolicMath';
import {
  DataType,
  MathNodeInstance,
  NodeConnection,
  NodeDefinition,
} from '../types';

export const SOCKET_COLORS: Record<DataType, string> = {
  scalar: '#8B9BB4',
  vector: '#B58BE0',
  matrix: '#4FB8AE',
  calculus: '#E0B05C',
  bool: '#E08BA8',
  int: '#7FC97F',
  string: '#A3A3AD',
  any: '#8E8E96',
  equation: '#A3A3AD',
};
export const compatibleTypes = (from: DataType, to: DataType) =>
  to === 'any' || from === to || (from === 'int' && to === 'scalar');
export function connectionError(
  connection: Pick<
    NodeConnection,
    'fromNodeId' | 'toNodeId' | 'fromSocket' | 'toSocket'
  >,
  nodes: MathNodeInstance[],
  connections: NodeConnection[],
  definitions: NodeDefinition[],
): string | null {
  const from = nodes.find((n) => n.id === connection.fromNodeId);
  const to = nodes.find((n) => n.id === connection.toNodeId);
  const output = definitions
    .find((d) => d.id === (from?.definitionId || from?.type))
    ?.outputs.find(
      (s) => s.name === connection.fromSocket && s.connectable !== false,
    );
  const input = definitions
    .find((d) => d.id === (to?.definitionId || to?.type))
    ?.inputs.find(
      (s) => s.name === connection.toSocket && s.connectable !== false,
    );
  if (!from || !to || !output || !input)
    return 'Missing node definition or socket';
  if (!compatibleTypes(output.type, input.type))
    return `Cannot connect ${output.type} to ${input.type}`;
  const visited = new Set<string>();
  const queue = [to.id];
  while (queue.length) {
    const id = queue.pop()!;
    if (id === from.id) return 'This connection would create a cycle';
    if (visited.has(id)) continue;
    visited.add(id);
    for (const c of connections) {
      if (c.toNodeId === to.id && c.toSocket === input.name) continue;
      if (c.fromNodeId === id) queue.push(c.toNodeId);
    }
  }
  return null;
}
export function matchesNode(def: NodeDefinition, query: string): boolean {
  const aliases: Record<string, string> = {
    'math.value':
      'number input scalar source symbol algebra variable letter A B x formula latex unknown parameter',
    'math.variable': 'symbol algebra letter A B x unknown named parameter',
    'math.equation': 'equality formula left right equals = algebra',
    'math.operations': 'add subtract multiply divide power modulo + - * / ^ %',
    'math.function': 'sin cos tan sqrt square root abs log ln exp',
    'math.constant': 'pi π e phi golden sqrt2',
    'math.output': 'display inspect result view',
    'math.matrix_mul': 'matrix product multiplication linear algebra',
  };
  const haystack =
    `${def.name} ${def.category || ''} ${def.description || ''} ${aliases[def.id] || ''}`.toLowerCase();
  return query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .every((term) => haystack.includes(term));
}
export function formatValue(value: unknown, precision = 6): string {
  precision = Math.max(1, Math.min(15, Math.trunc(precision) || 6));
  if (value === undefined || value === null) return '—';
  if (isSymbolic(value) || isEquation(value)) {
    try {
      return formatMath(value, (n) => formatValue(n, precision));
    } catch {
      return 'Invalid expression';
    }
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value);
    if (value !== 0 && (Math.abs(value) < 1e-4 || Math.abs(value) >= 1e8))
      return value.toExponential(precision - 1);
    return String(Number(value.toPrecision(precision)));
  }
  if (Array.isArray(value))
    return value
      .map((v) =>
        Array.isArray(v)
          ? `[${v.map((x) => formatValue(x, precision)).join(', ')}]`
          : formatValue(v, precision),
      )
      .join('\n');
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
