import { MathGraph, MathNodeInstance, NodeConnection } from '../types';
import { computeEngine, parseLatex } from './latexRuntime';
/** Decompose supported arithmetic into inspectable nodes; preserve unsupported forms atomically. */
export function formulaGraph(
  latex: string,
  assigned: Record<string, number> = {},
) {
  const parsed = parseLatex(latex),
    ce = computeEngine(),
    nodes: MathNodeInstance[] = [],
    connections: NodeConnection[] = [],
    steps: { nodeId: string; description: string }[] = [],
    memo = new Map<string, { id: string; socket: string; depth: number }>(),
    levels = new Map<number, number>();
  const add = (
    type: string,
    title: string,
    values: Record<string, unknown>,
    children: {
      port: string;
      source: { id: string; socket: string; depth: number };
    }[] = [],
  ) => {
    const depth = children.length
        ? Math.max(...children.map((c) => c.source.depth)) + 1
        : 0,
      index = levels.get(depth) || 0;
    levels.set(depth, index + 1);
    const id = `step-${nodes.length + 1}`;
    nodes.push({
      id,
      type,
      definitionId: type,
      title,
      x: depth * 340,
      y: index * 300,
      values,
    });
    for (const c of children)
      connections.push({
        id: `wire-${connections.length + 1}`,
        fromNodeId: c.source.id,
        fromSocket: c.source.socket,
        toNodeId: id,
        toSocket: c.port,
      });
    steps.push({ nodeId: id, description: title });
    return {
      id,
      socket:
        type === 'math.value'
          ? 'value'
          : type === 'math.equation'
            ? 'equation'
            : 'result',
      depth,
    };
  };
  const functions: Record<string, string> = {
    Sqrt: 'sqrt',
    Root: 'root',
    Abs: 'abs',
    Sin: 'sin',
    Cos: 'cos',
    Tan: 'tan',
    Arcsin: 'asin',
    Arccos: 'acos',
    Arctan: 'atan',
    Sinh: 'sinh',
    Cosh: 'cosh',
    Tanh: 'tanh',
    Ln: 'ln',
    Exp: 'exp',
    Negate: 'negate',
    Floor: 'floor',
    Ceil: 'ceil',
    Round: 'round',
    Sign: 'sign',
  };
  const visit = (
    json: unknown,
  ): { id: string; socket: string; depth: number } => {
    const key = JSON.stringify(json),
      found = memo.get(key);
    if (found) return found;
    let out: { id: string; socket: string; depth: number };
    if (
      Array.isArray(json) &&
      ['Add', 'Multiply', 'Subtract', 'Divide', 'Rational', 'Power'].includes(
        String(json[0]),
      ) &&
      json.length >= 3
    ) {
      const operation = (
        {
          Add: '+',
          Multiply: '*',
          Subtract: '-',
          Divide: '/',
          Rational: '/',
          Power: '^',
        } as Record<string, string>
      )[String(json[0])];
      let source = visit(json[1]);
      for (const part of json.slice(2))
        source = add(
          'math.operations',
          `Calculate ${operation}`,
          {
            operation: (
              {
                '+': 'Add (+)',
                '-': 'Subtract (-)',
                '*': 'Multiply (*)',
                '/': 'Divide (/)',
                '^': 'Power (^)',
              } as Record<string, string>
            )[operation],
          },
          [
            { port: 'a', source },
            { port: 'b', source: visit(part) },
          ],
        );
      out = source;
    } else if (
      Array.isArray(json) &&
      json[0] === 'Equal' &&
      json.length === 3
    ) {
      out = add('math.equation', 'Equation', {}, [
        { port: 'left', source: visit(json[1]) },
        { port: 'right', source: visit(json[2]) },
      ]);
    } else if (
      Array.isArray(json) &&
      functions[String(json[0])] &&
      json.length >= 2
    ) {
      const name = functions[String(json[0])];
      out = add(`standard.${name}`, String(json[0]), {}, [
        { port: 'x', source: visit(json[1]) },
        ...(name === 'root'
          ? [{ port: 'degree', source: visit(json[2] ?? 2) }]
          : []),
      ]);
    } else {
      const raw =
        typeof json === 'number'
          ? json
          : typeof json === 'string' && /^[a-zA-Z]$/.test(json)
            ? json
            : ce.box(json as never).latex;
      out = add('math.value', `Value ${String(raw).slice(0, 50)}`, {
        value: raw,
        ...(typeof raw === 'string' && assigned[raw] !== undefined
          ? { assigned: true, binding: assigned[raw] }
          : {}),
      });
    }
    memo.set(key, out);
    return out;
  };
  const output = visit(parsed.json);
  add('math.output', 'View Result', {}, [{ port: 'input', source: output }]);
  const graph: MathGraph = {
    id: crypto.randomUUID(),
    title: 'Formula Steps',
    nodes,
    connections,
    frames: [],
    pan: { x: 0, y: 0 },
    zoom: 1,
    lastEdited: 'Just now',
    isModified: true,
  };
  return { graph, steps, unknowns: parsed.unknowns, latex: parsed.latex };
}
