import { MathNodeInstance, NodeDefinition } from '../types';
export const HEADER_HEIGHT = 42;
export const BODY_PADDING = 14;
export const ROW_GAP = 10;
export function inputRowHeight(widget?: string, type?: string): number {
  return widget === 'matrix4x4'
    ? 132
    : widget === 'matrix2x2'
      ? 72
      : type === 'scalar' || type === 'equation' || type === 'any'
        ? 44
        : 32;
}
export function getNodeSocketYOffset(
  node: MathNodeInstance,
  name: string,
  output: boolean,
  definition?: NodeDefinition,
): number {
  if (node.collapsed) {
    const sockets = (output ? definition?.outputs : definition?.inputs)?.filter(
      (s) => s.connectable !== false,
    );
    const index = Math.max(0, sockets?.findIndex((s) => s.name === name) ?? 0);
    return HEADER_HEIGHT + 12 + index * 22;
  }
  let y = HEADER_HEIGHT + BODY_PADDING;
  if (!definition) return y + 16;
  if ((node.definitionId || node.type) === 'math.value')
    return y + (output ? 84 : 0) + 26;
  for (const input of definition.inputs) {
    const h = inputRowHeight(input.widget, input.type);
    if (!output && input.name === name) return y + h / 2;
    y += h + ROW_GAP;
  }
  const index = Math.max(
    0,
    definition.outputs.findIndex((s) => s.name === name),
  );
  return y + index * (52 + ROW_GAP) + 26;
}
export function getNodeMinDimensions(
  node: MathNodeInstance,
  definition?: NodeDefinition,
): { minWidth: number; minHeight: number } {
  if (node.collapsed)
    return {
      minWidth: 220,
      minHeight:
        HEADER_HEIGHT +
        24 +
        Math.max(
          0,
          Math.max(
            definition?.inputs.filter((s) => s.connectable !== false).length ||
              0,
            definition?.outputs.length || 0,
          ) - 1,
        ) *
          22,
    };
  const rows =
    definition?.inputs.reduce(
      (sum, s) => sum + inputRowHeight(s.widget, s.type) + ROW_GAP,
      0,
    ) || 0;
  const outputHeight = (definition?.outputs.length || 0) * (52 + ROW_GAP);
  const type = node.definitionId || node.type;
  return {
    minWidth: 260,
    minHeight: Math.max(
      120,
      HEADER_HEIGHT +
        BODY_PADDING * 2 +
        rows +
        outputHeight +
        (type === 'math.value' ? 74 : type === 'math.output' ? 80 : 0),
    ),
  };
}
export function getSocketWorldCenter(
  node: MathNodeInstance,
  name: string,
  output: boolean,
  definition?: NodeDefinition,
): { x: number; y: number } {
  return {
    x:
      node.x +
      (output
        ? Math.max(
            getNodeMinDimensions(node, definition).minWidth,
            node.width || 260,
          )
        : 0),
    y: node.y + getNodeSocketYOffset(node, name, output, definition),
  };
}
