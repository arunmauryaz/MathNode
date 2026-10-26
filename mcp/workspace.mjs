import {
  mkdir,
  readFile,
  readdir,
  writeFile,
  rename,
  realpath,
} from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';

export class Workspace {
  constructor(root, core) {
    this.root = resolve(root);
    this.core = core;
    this.projects = new Map();
    this.library = [];
    this.folders = [];
    this.histories = new Map();
  }
  async init() {
    await mkdir(join(this.root, 'projects'), { recursive: true });
    await mkdir(join(this.root, 'exports'), { recursive: true });
    this.root = await realpath(this.root);
    try {
      const saved = JSON.parse(
        await readFile(join(this.root, 'library.json'), 'utf8'),
      );
      this.library = saved.definitions.map((d) =>
        this.core.validateNode(JSON.stringify(d)),
      );
      this.folders = saved.folders || [];
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    for (const entry of await readdir(join(this.root, 'projects')))
      if (/^[a-zA-Z0-9_-]+\.json$/.test(entry)) {
        const raw = JSON.parse(
          await readFile(join(this.root, 'projects', entry), 'utf8'),
        );
        const graph = this.core.parseGraph(JSON.stringify(raw.graph));
        this.projects.set(raw.id, { ...raw, graph });
      }
  }
  async safePath(path) {
    const absolute = resolve(this.root, path),
      rel = relative(this.root, absolute);
    if (rel.startsWith('..') || isAbsolute(rel))
      throw Error('Path must remain inside the MCP workspace');
    let existing = absolute;
    while (true) {
      try {
        const real = await realpath(existing);
        const r = relative(this.root, real);
        if (r.startsWith('..') || isAbsolute(r))
          throw Error('Symlinks cannot leave the MCP workspace');
        break;
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
        const next = resolve(existing, '..');
        if (next === existing) throw e;
        existing = next;
      }
    }
    return absolute;
  }
  async atomic(path, data) {
    path = await this.safePath(path);
    const temporary = path + '.' + randomUUID() + '.tmp';
    await writeFile(temporary, JSON.stringify(data, null, 2));
    await rename(temporary, path);
  }
  definitions(project) {
    return [
      ...new Map(
        [
          ...this.core.DEFAULT_NODE_DEFINITIONS,
          ...this.library,
          ...(project?.definitions || []),
        ].map((d) => [d.id, d]),
      ).values(),
    ];
  }
  project(id) {
    const p = this.projects.get(id);
    if (!p) throw Error(`Unknown project: ${id}`);
    return p;
  }
  validate(graph, definitions) {
    if (
      (graph.nodes?.length || 0) > 2000 ||
      (graph.connections?.length || 0) > 10000
    )
      throw Error('Graph limit: 2000 nodes and 10000 connections');
    const parsed = this.core.parseGraph(JSON.stringify(graph));
    for (const n of parsed.nodes) {
      if (!definitions.some((d) => d.id === (n.definitionId || n.type)))
        throw Error(`Missing definition: ${n.definitionId || n.type}`);
    }
    for (const c of parsed.connections) {
      const error = this.core.connectionError(
        c,
        parsed.nodes,
        parsed.connections,
        definitions,
      );
      if (error) throw Error(`${c.id}: ${error}`);
    }
    return parsed;
  }
  async create(name, graph, definitions = [], preserveGraphId = false) {
    const id = randomUUID();
    const p = {
      id,
      revision: 0,
      graph: graph || {
        id,
        title: name,
        nodes: [],
        connections: [],
        frames: [],
        pan: { x: 0, y: 0 },
        zoom: 1,
      },
      definitions,
      updatedAt: new Date().toISOString(),
    };
    if (!preserveGraphId) p.graph.id = id;
    p.graph.title = name;
    p.graph = this.validate(p.graph, this.definitions(p));
    await this.atomic(`projects/${id}.json`, p);
    this.projects.set(id, p);
    return p;
  }
  async commit(id, draft, expectedRevision, history = true) {
    const current = this.project(id);
    if (expectedRevision !== undefined && current.revision !== expectedRevision)
      throw Error(
        `Revision conflict: expected ${expectedRevision}, current ${current.revision}. Read project again.`,
      );
    draft.graph = this.validate(draft.graph, this.definitions(draft));
    const next = {
      ...draft,
      id,
      revision: current.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    await this.atomic(`projects/${id}.json`, next);
    if (history) {
      const h = this.histories.get(id) || { undo: [], redo: [] };
      h.undo.push(structuredClone(current));
      if (h.undo.length > 50) h.undo.shift();
      h.redo = [];
      this.histories.set(id, h);
    }
    this.projects.set(id, next);
    return next;
  }
  async install(definition, folder) {
    if (this.core.DEFAULT_NODE_DEFINITIONS.some((d) => d.id === definition.id))
      throw Error('Custom nodes cannot replace reserved bundled IDs');
    definition = { ...definition, folderId: folder || 'folder-my-nodes' };
    this.library = [
      ...this.library.filter((d) => d.id !== definition.id),
      definition,
    ];
    await this.atomic('library.json', {
      definitions: this.library,
      folders: this.folders,
    });
    return definition;
  }
  summary(p) {
    return {
      id: p.id,
      title: p.graph.title,
      revision: p.revision,
      nodes: p.graph.nodes.length,
      connections: p.graph.connections.length,
      updatedAt: p.updatedAt,
    };
  }
}
