import { NodeDefinition } from '../types';
export const VALUE_DEFINITION: NodeDefinition = {
  id: 'math.value',
  name: 'Value',
  folderId: 'folder-basic-math',
  category: 'Basic Math',
  badge: 'VALUE',
  icon: 'slider',
  description:
    'Enter a number, named symbol, or LaTeX formula. Connect to operations or substitute numerical values.',
  inputs: [], // No input sockets - this is a value source!
  outputs: [
    {
      name: 'value',
      type: 'scalar',
      description: 'Output scalar value',
    },
  ],
  code: `(inputs, math) => {
  return { value: math.value(inputs.value ?? 10, inputs.assigned ? inputs.binding : undefined) };
}`,
};
