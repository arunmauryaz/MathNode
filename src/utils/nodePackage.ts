import JSZip from 'jszip';
import { MathNodeFolder, NodeDefinition } from '../types';
import { parseMNode } from './nodeParser';
export function mergeDefinitions(
  existing: NodeDefinition[],
  incoming: NodeDefinition[],
): NodeDefinition[] {
  return [
    ...new Map(
      [...existing, ...incoming].map((node) => [node.id, node]),
    ).values(),
  ];
}
export async function readNodePackage(
  file: Blob | Uint8Array,
  name: string,
  parentId: string | null = null,
) {
  const zip = await JSZip.loadAsync(file);
  const rootId = crypto.randomUUID();
  const folders: MathNodeFolder[] = [
    {
      id: rootId,
      name: name.replace(/\.zip$/i, ''),
      parentId,
      isPackage: true,
    },
  ];
  const folderPaths = new Map<string, string>([['', rootId]]);
  const nodes: NodeDefinition[] = [];
  let skipped = 0;
  const ensureFolder = (path: string): string => {
    const existing = folderPaths.get(path);
    if (existing) return existing;
    const parts = path.split('/');
    const folderName = parts.pop()!;
    const folder: MathNodeFolder = {
      id: crypto.randomUUID(),
      name: folderName,
      parentId: ensureFolder(parts.join('/')),
    };
    folders.push(folder);
    folderPaths.set(path, folder.id);
    return folder.id;
  };
  for (const [path, entry] of Object.entries(zip.files)) {
    if (
      entry.dir ||
      path.startsWith('__MACOSX/') ||
      !/\.(mnode|json)$/i.test(path)
    )
      continue;
    const parts = path.split('/');
    const fileName = parts.pop()!;
    const node = parseMNode(await entry.async('string'), null, fileName);
    if (!node) {
      skipped++;
      continue;
    }
    node.folderId = ensureFolder(parts.join('/'));
    nodes.push(node);
  }
  if (!nodes.length)
    throw new Error('The archive contains no valid .mnode definitions');
  return { folders, nodes: mergeDefinitions([], nodes), rootId, skipped };
}
