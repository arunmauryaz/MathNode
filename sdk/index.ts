import { NodeDefinition, NodeSocketDef } from '../src/types';
import { parseMNode } from '../src/utils/nodeParser';
import { executeMathGraph } from '../src/utils/dagEngine';
import {
  STANDARD_NODE_DEFINITIONS,
  STANDARD_EXAMPLES,
} from '../src/utils/standardLibrary';
import { numericValue, isSymbolic, toLatex } from '../src/utils/symbolicMath';
export { STANDARD_NODE_DEFINITIONS, STANDARD_EXAMPLES };
export type { NodeDefinition, NodeSocketDef };
/** Validate format without executing a kernel. Reserved Value IDs are migrated. */
export function validateNode(source: string): NodeDefinition {
  const raw = JSON.parse(source);
  const definition = parseMNode(
    source,
    typeof raw?.folderId === 'string' ? raw.folderId : null,
  );
  if (!definition)
    throw new Error(
      'Invalid .mnode definition: check socket names, types, widgets, kernel, and composite bindings',
    );
  if (!definition.composite && !definition.code?.trim())
    throw new Error('A node needs a kernel or composite graph');
  return definition;
}
export function defineNode(definition: NodeDefinition): NodeDefinition {
  return validateNode(JSON.stringify(definition));
}
/** Runs trusted kernel code. CLI wraps this in a worker with a deadline. */
export function runExample(
  definition: NodeDefinition,
  values: Record<string, unknown> = {},
) {
  const result = executeMathGraph(
    [
      {
        id: 'sdk-example',
        type: definition.id,
        title: definition.name,
        x: 0,
        y: 0,
        values,
      },
    ],
    [],
    [definition],
  ).updatedNodes[0];
  if (result.error) throw new Error(result.error);
  return Object.fromEntries(
    Object.entries(result.computedOutputs || {}).map(([key, v]) => [
      key,
      isSymbolic(v) ? { latex: toLatex(v), value: numericValue(v) } : v,
    ]),
  );
}
export const scaffold: NodeDefinition = {
  id: 'custom.square-plus-one',
  name: 'Square Plus One',
  category: 'Custom',
  description: 'Compute x² + 1 for numeric or symbolic inputs.',
  inputs: [{ name: 'x', type: 'scalar', default: 2, widget: 'number' }],
  outputs: [{ name: 'result', type: 'scalar' }],
  code: "(inputs, math) => ({ result: math.operate('+', math.operate('^', inputs.x, 2), 1) })",
};
export {
  DEFAULT_NODE_DEFINITIONS,
  DEFAULT_FOLDERS,
} from '../src/utils/defaultNodes';
export { parseGraph, exportGraph } from '../src/utils/graphFile';
export {
  connectionError,
  formatValue,
  matchesNode,
} from '../src/utils/graphRules';
export { getNodeMinDimensions } from '../src/utils/socketGeometry';
export {
  createCompositeDefinition,
  replaceSelectionWithComposite,
  exportMNode,
  cleanInstance,
} from '../src/utils/compositeNodes';
export { executeMathGraph } from '../src/utils/dagEngine';
export {
  value,
  substitute,
  toLatex,
  numericValue,
} from '../src/utils/symbolicMath';
export { formulaGraph } from '../src/utils/formulaGraph';
export { unpackComposite } from '../src/utils/unpackComposite';
