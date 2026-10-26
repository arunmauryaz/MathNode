import { createCompositeDefinition } from '../../utils/compositeNodes';
import { useNodePreview } from '../../hooks/useNodePreview';
import { NodePreview } from '../nodes/NodePreview';
import { CreateSelectionModal } from '../modals/CreateSelectionModal';
import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { NavigatorMinimap } from './NavigatorMinimap';
import {
  AppSettings,
  MathNodeInstance,
  MathFrame,
  NodeConnection,
  NodeDefinition,
  ClipboardData,
  GraphSnapshot,
} from '../../types';
import { Search, X } from 'lucide-react';
import { MathNodeCard } from '../nodes/MathNodeCard';
import { ConnectionWires } from '../nodes/ConnectionWires';
import { MathIcon } from '../nodes/MathIcon';
import {
  getSocketWorldCenter,
  getNodeMinDimensions,
} from '../../utils/socketGeometry';
import {
  compatibleTypes,
  connectionError,
  formatValue,
  matchesNode,
} from '../../utils/graphRules';
type Attachment = {
  nodeId: string;
  socketName: string;
  isOutput: boolean;
  wireId?: string;
};
type WireDrag = Attachment & {
  startClientX: number;
  startClientY: number;
  curWorldX: number;
  curWorldY: number;
  moved: boolean;
};
type Menu = {
  x: number;
  y: number;
  worldX: number;
  worldY: number;
  nodeId?: string;
  socket?: Attachment;
  wireId?: string;
  frameId?: string;
};
interface WorkspaceCanvasProps {
  graphTitle: string;
  pan: { x: number; y: number };
  zoom: number;
  nodes?: MathNodeInstance[];
  connections?: NodeConnection[];
  frames?: MathFrame[];
  definitions?: NodeDefinition[];
  settings: AppSettings;
  disabled?: boolean;
  readOnly?: boolean;
  onCreateComposite?: (
    definition: NodeDefinition,
    ids: string[],
  ) => string | undefined;
  onInspectNode?: (node: MathNodeInstance) => void;
  saveStatus: string;
  onUpdateView: (pan: { x: number; y: number }, zoom: number) => void;
  onUpdateNodes?: (nodes: MathNodeInstance[], history?: boolean) => void;
  onUpdateConnections?: (
    connections: NodeConnection[],
    history?: boolean,
  ) => void;
  onMutateGraph?: (
    updater: (current: GraphSnapshot) => GraphSnapshot,
    history?: boolean,
  ) => void;
  onCommitHistory: (snapshot: GraphSnapshot) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onOpenNodeLibrary: () => void;
  onFileDrop: (file: File) => void;
  onCopyNotice: (message: string) => void;
  onSpawnNode?: (
    definitionId: string,
    x?: number,
    y?: number,
    attachment?: Attachment,
  ) => string | undefined;
}
let graphClipboard: ClipboardData | null = null;
let wireClipboard: NodeConnection[] | null = null;
let clipboardMode: 'nodes' | 'wires' = 'nodes';
export function getNodeGroupBounds(
  nodes: MathNodeInstance[] = [],
  frames: MathFrame[] = [],
) {
  const items = [
    ...nodes.map((n) => ({
      x: n.x,
      y: n.y,
      width: n.width || 260,
      height: n.collapsed ? 70 : n.height || 160,
    })),
    ...frames,
  ];
  if (!items.length) return null;
  const minX = Math.min(...items.map((n) => n.x)),
    minY = Math.min(...items.map((n) => n.y));
  const maxX = Math.max(...items.map((n) => n.x + n.width)),
    maxY = Math.max(...items.map((n) => n.y + n.height));
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}
export const WorkspaceCanvas: React.FC<WorkspaceCanvasProps> = ({
  pan,
  zoom,
  nodes = [],
  connections = [],
  frames = [],
  definitions = [],
  settings,
  disabled,
  readOnly = false,
  onCreateComposite,
  onInspectNode,
  saveStatus,
  onUpdateView,
  onUpdateNodes,
  onMutateGraph,
  onCommitHistory,
  onUndo,
  onRedo,
  onOpenNodeLibrary,
  onFileDrop,
  onCopyNotice,
  onSpawnNode,
}) => {
  useEffect(() => {
    if (!readOnly && /failed/i.test(saveStatus)) onCopyNotice(saveStatus);
  }, [saveStatus, readOnly, onCopyNotice]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1200, height: 800 });
  const [creation, setCreation] = useState<{
    mode: 'group' | 'node';
    ids: string[];
    graph: GraphSnapshot;
  } | null>(null);
  const blocked = disabled || !!creation;
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedWires, setSelectedWires] = useState<string[]>([]);
  const [space, setSpace] = useState(false);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [rename, setRename] = useState<string | null>(null);
  const [picker, setPicker] = useState<{
    x: number;
    y: number;
    worldX: number;
    worldY: number;
    query: string;
    attachment?: Attachment;
  } | null>(null);
  const [pickerIndex, setPickerIndex] = useState(0);
  const pickerPreview = useNodePreview(!!picker && !blocked);
  const [wire, setWire] = useState<WireDrag | null>(null);
  const wireRef = useRef<WireDrag | null>(null);
  const setActiveWire = (next: WireDrag | null) => {
    wireRef.current = next;
    setWire(next);
  };
  const [snapTarget, setSnapTarget] = useState<Attachment | null>(null);
  const [marquee, setMarquee] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const mouse = useRef<{
    x: number;
    y: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const transaction = useRef<GraphSnapshot | null>(null);
  const drag = useRef<null | {
    clientX: number;
    clientY: number;
    pan: typeof pan;
    starts: MathNodeInstance[];
    frameStarts: MathFrame[];
    anchor: string;
    moved: boolean;
  }>(null);
  const panDrag = useRef<null | { x: number; y: number; pan: typeof pan }>(
    null,
  );
  const boxDrag = useRef<null | { x: number; y: number; initial: string[] }>(
    null,
  );
  const resize = useRef<null | {
    id: string;
    handle: 'tl' | 'tr' | 'bl' | 'br';
    x: number;
    y: number;
    node: MathNodeInstance;
    width: number;
    height: number;
  }>(null);
  const previousIds = useRef(new Set(nodes.map((n) => n.id)));
  const defs = useMemo(
    () => new Map(definitions.map((d) => [d.id, d])),
    [definitions],
  );
  const current = useRef({ nodes, connections, frames });
  current.current = { nodes, connections, frames };
  const beginEdit = useCallback(() => {
    if (!transaction.current)
      transaction.current = structuredClone(current.current);
  }, []);
  const endEdit = useCallback(() => {
    if (transaction.current) {
      onCommitHistory(transaction.current);
      transaction.current = null;
    }
  }, [onCommitHistory]);
  const mutate = useCallback(
    (updater: (graph: GraphSnapshot) => GraphSnapshot, history = true) =>
      onMutateGraph?.(updater, history),
    [onMutateGraph],
  );
  const center = { x: size.width / 2 + pan.x, y: size.height / 2 + pan.y };
  const world = (x: number, y: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: (x - rect.left - center.x) / zoom,
      y: (y - rect.top - center.y) / zoom,
    };
  };
  const dims = (node: MathNodeInstance) => {
    const min = getNodeMinDimensions(
      node,
      defs.get(node.definitionId || node.type),
    );
    return {
      width: Math.max(min.minWidth, node.width || 260),
      height: node.collapsed
        ? min.minHeight
        : Math.max(min.minHeight, node.height || min.minHeight),
    };
  };
  const fit = (selection = false) => {
    const target =
      selection && selected.length
        ? nodes.filter((n) => selected.includes(n.id))
        : nodes;
    const bounds = getNodeGroupBounds(
      target.map((n) => ({ ...n, ...dims(n) })),
      selection && selected.length ? [] : frames,
    );
    if (!bounds) {
      onUpdateView({ x: 0, y: 0 }, 1);
      return;
    }
    const nextZoom = Math.min(
      1.25,
      Math.max(
        0.2,
        Math.min(
          (size.width - 120) / Math.max(1, bounds.width),
          (size.height - 120) / Math.max(1, bounds.height),
        ),
      ),
    );
    onUpdateView(
      { x: -bounds.centerX * nextZoom, y: -bounds.centerY * nextZoom },
      nextZoom,
    );
  };
  const openPicker = (
    x: number,
    y: number,
    point: { x: number; y: number },
    attachment?: Attachment,
  ) => {
    setMenu(null);
    setPickerIndex(0);
    setPicker({
      x,
      y,
      worldX: point.x,
      worldY: point.y,
      query: '',
      attachment,
    });
  };
  useEffect(() => {
    const el = containerRef.current!;
    const update = () =>
      setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const added = nodes.filter((n) => !previousIds.current.has(n.id));
    previousIds.current = new Set(nodes.map((n) => n.id));
    if (added.length) setSelectedWires([]);
    setSelected((prev) =>
      added.length
        ? added.map((n) => n.id)
        : prev.filter((id) => previousIds.current.has(id)),
    );
  }, [nodes]);
  useEffect(() => {
    if (disabled) {
      setMenu(null);
      setPicker(null);
      setActiveWire(null);
      setSpace(false);
      drag.current = null;
      panDrag.current = null;
      resize.current = null;
      boxDrag.current = null;
      setMarquee(null);
      endEdit();
    }
  }, [disabled, endEdit]);
  useEffect(() => {
    const outside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-canvas-menu]')) {
        setMenu(null);
        setPicker(null);
      }
    };
    window.addEventListener('mousedown', outside);
    return () => window.removeEventListener('mousedown', outside);
  }, []);
  useEffect(() => {
    setSelectedWires((ids) =>
      ids.filter((id) => connections.some((c) => c.id === id)),
    );
  }, [connections]);
  const selectWire = (e: React.MouseEvent, id: string) => {
    setMenu(null);
    setSelected([]);
    setSelectedWires((previous) =>
      e.shiftKey || e.ctrlKey || e.metaKey
        ? previous.includes(id)
          ? previous.filter((w) => w !== id)
          : [...previous, id]
        : [id],
    );
  };
  const copyWires = (ids = selectedWires) => {
    wireClipboard = structuredClone(
      connections.filter((c) => ids.includes(c.id)),
    );
    if (!wireClipboard.length) return;
    clipboardMode = 'wires';
    void navigator.clipboard
      ?.writeText(
        JSON.stringify(
          { format: 'mathnode-wires', connections: wireClipboard },
          null,
          2,
        ),
      )
      .catch(() => {});
    onCopyNotice(`Copied ${wireClipboard.length} connection(s)`);
  };
  const beginCreation = (mode: 'group' | 'node', ids = selected) => {
    if (ids.length < 2 || readOnly) return;
    endEdit();
    setMenu(null);
    setPicker(null);
    setActiveWire(null);
    setCreation({
      mode,
      ids: [...ids],
      graph: structuredClone({ nodes, connections, frames }),
    });
  };
  const finishCreation = (name: string, definition?: NodeDefinition) => {
    if (!creation) return;
    if (creation.mode === 'node' && definition) {
      const id = onCreateComposite?.(definition, creation.ids);
      if (!id) return;
      setSelected([id]);
    } else {
      const members = nodes.filter((n) => creation.ids.includes(n.id));
      const bounds = getNodeGroupBounds(
        members.map((n) => ({ ...n, ...dims(n) })),
      );
      if (!bounds) return;
      const frame: MathFrame = {
        id: crypto.randomUUID(),
        title: name,
        color: '#4B78D8',
        x: bounds.minX - 24,
        y: bounds.minY - 52,
        width: bounds.width + 48,
        height: bounds.height + 76,
        nodeIds: members.map((n) => n.id),
      };
      mutate((g) => ({ ...g, frames: [...(g.frames || []), frame] }));
      onCopyNotice(`Created group "${name}"`);
    }
    setCreation(null);
  };
  const copy = () => {
    if (!selected.length && selectedWires.length) {
      copyWires();
      return;
    }
    const picked = nodes.filter((n) => selected.includes(n.id));
    const bounds = getNodeGroupBounds(picked);
    if (!bounds) return;
    clipboardMode = 'nodes';
    graphClipboard = structuredClone({
      nodes: picked,
      connections: connections.filter(
        (c) => selected.includes(c.fromNodeId) && selected.includes(c.toNodeId),
      ),
      center: { x: bounds.centerX, y: bounds.centerY },
    });
    onCopyNotice(`Copied ${picked.length} node(s)`);
  };
  const deleteSelected = () => {
    mutate((g) => ({
      nodes: g.nodes.filter((n) => !selected.includes(n.id)),
      connections: g.connections.filter(
        (c) =>
          !selectedWires.includes(c.id) &&
          !selected.includes(c.fromNodeId) &&
          !selected.includes(c.toNodeId),
      ),
    }));
    setSelected([]);
    setSelectedWires([]);
  };
  const clone = (
    clipboard: ClipboardData | null,
    point?: { x: number; y: number },
  ) => {
    if (!clipboard) return;
    const ids = new Map(
      clipboard.nodes.map((n) => [n.id, crypto.randomUUID()]),
    );
    const grid = settings.gridDotSpacing;
    let dx = point ? point.x - clipboard.center.x : 36,
      dy = point ? point.y - clipboard.center.y : 36;
    if (settings.snapToGrid && clipboard.nodes.length) {
      dx =
        Math.round((clipboard.nodes[0].x + dx) / grid) * grid -
        clipboard.nodes[0].x;
      dy =
        Math.round((clipboard.nodes[0].y + dy) / grid) * grid -
        clipboard.nodes[0].y;
    }
    const clones = structuredClone(clipboard.nodes).map((n) => ({
      ...n,
      id: ids.get(n.id)!,
      x: n.x + dx,
      y: n.y + dy,
      computedOutputs: undefined,
      error: null,
    }));
    mutate((g) => ({
      nodes: [...g.nodes, ...clones],
      connections: [
        ...g.connections,
        ...clipboard.connections.map((c) => ({
          ...c,
          id: crypto.randomUUID(),
          fromNodeId: ids.get(c.fromNodeId)!,
          toNodeId: ids.get(c.toNodeId)!,
        })),
      ],
    }));
    setSelected(clones.map((n) => n.id));
  };
  const paste = (point?: { x: number; y: number }) => {
    if (clipboardMode === 'nodes') {
      clone(graphClipboard, point);
      return;
    }
    if (!wireClipboard?.length) return;
    const additions: NodeConnection[] = [];
    let next = connections;
    for (const c of wireClipboard) {
      if (
        next.some(
          (existing) =>
            existing.fromNodeId === c.fromNodeId &&
            existing.fromSocket === c.fromSocket &&
            existing.toNodeId === c.toNodeId &&
            existing.toSocket === c.toSocket,
        )
      )
        continue;
      const error = connectionError(c, nodes, next, definitions);
      if (error) {
        onCopyNotice(`Cannot paste connection: ${error}`);
        return;
      }
      const restored = { ...c, id: crypto.randomUUID() };
      additions.push(restored);
      next = [
        ...next.filter(
          (existing) =>
            !(
              existing.toNodeId === c.toNodeId &&
              existing.toSocket === c.toSocket
            ),
        ),
        restored,
      ];
    }
    if (!additions.length) {
      onCopyNotice('These connections already exist');
      return;
    }
    mutate((g) => ({
      ...g,
      connections: additions.reduce(
        (result, c) =>
          connectionError(c, g.nodes, result, definitions)
            ? result
            : [
                ...result.filter(
                  (existing) =>
                    !(
                      existing.toNodeId === c.toNodeId &&
                      existing.toSocket === c.toSocket
                    ),
                ),
                c,
              ],
        g.connections,
      ),
    }));
    setSelected([]);
    setSelectedWires(additions.map((c) => c.id));
  };
  const duplicate = (ids = selected) =>
    clone({
      nodes: nodes.filter((n) => ids.includes(n.id)),
      connections: connections.filter(
        (c) => ids.includes(c.fromNodeId) && ids.includes(c.toNodeId),
      ),
      center: { x: 0, y: 0 },
    });
  const disconnect = () =>
    mutate((g) => ({
      ...g,
      connections: g.connections.filter(
        (c) =>
          !selected.includes(c.fromNodeId) && !selected.includes(c.toNodeId),
      ),
    }));
  const toggleCollapse = (id: string) =>
    mutate((g) => ({
      ...g,
      nodes: g.nodes.map((n) =>
        n.id === id ? { ...n, collapsed: !n.collapsed } : n,
      ),
    }));
  const updateTitle = (id: string, title: string) =>
    mutate((g) => ({
      ...g,
      nodes: g.nodes.map((n) => (n.id === id ? { ...n, title } : n)),
    }));
  const candidate = (source: Attachment, target: Attachment) => ({
    fromNodeId: source.isOutput ? source.nodeId : target.nodeId,
    fromSocket: source.isOutput ? source.socketName : target.socketName,
    toNodeId: source.isOutput ? target.nodeId : source.nodeId,
    toSocket: source.isOutput ? target.socketName : source.socketName,
  });
  const compatible = (source: Attachment, target: Attachment) =>
    source.isOutput !== target.isOutput &&
    !connectionError(
      candidate(source, target),
      nodes,
      connections,
      definitions,
    );
  const nearest = (source: WireDrag, point: { x: number; y: number }) => {
    let best: Attachment | null = null,
      distance = 20 / zoom;
    for (const node of nodes) {
      const def = defs.get(node.definitionId || node.type);
      if (!def) continue;
      for (const s of source.isOutput ? def.inputs : def.outputs) {
        if (s.connectable === false) continue;
        const target = {
          nodeId: node.id,
          socketName: s.name,
          isOutput: !source.isOutput,
        };
        if (!compatible(source, target)) continue;
        const p = getSocketWorldCenter(node, s.name, !source.isOutput, def);
        const d = Math.hypot(p.x - point.x, p.y - point.y);
        if (d < distance) {
          distance = d;
          best = target;
        }
      }
    }
    return best;
  };
  const connect = (target: Attachment) => {
    const active = wireRef.current;
    if (!active) return;
    if (
      active.nodeId === target.nodeId &&
      active.socketName === target.socketName &&
      active.isOutput === target.isOutput
    )
      return;
    if (active.isOutput === target.isOutput) {
      onCopyNotice('Connect an output to an input');
      setActiveWire(null);
      return;
    }
    const connection = candidate(active, target);
    const original = active.wireId
      ? connections.find((c) => c.id === active.wireId)
      : undefined;
    if (
      original &&
      original.fromNodeId === connection.fromNodeId &&
      original.fromSocket === connection.fromSocket &&
      original.toNodeId === connection.toNodeId &&
      original.toSocket === connection.toSocket
    ) {
      setActiveWire(null);
      setSnapTarget(null);
      return;
    }
    const error = connectionError(connection, nodes, connections, definitions);
    if (error) {
      onCopyNotice(error);
      setActiveWire(null);
      setSnapTarget(null);
      return;
    }
    mutate((g) => {
      if (connectionError(connection, g.nodes, g.connections, definitions))
        return g;
      return {
        ...g,
        connections: [
          ...g.connections.filter(
            (c) =>
              c.id !== active.wireId &&
              !(
                c.toNodeId === connection.toNodeId &&
                c.toSocket === connection.toSocket
              ),
          ),
          { ...connection, id: active.wireId || crypto.randomUUID() },
        ],
      };
    });
    setActiveWire(null);
    setSnapTarget(null);
  };
  const startWire = (
    id: string,
    socketName: string,
    isOutput: boolean,
    x: number,
    y: number,
    branch = false,
  ) => {
    if (readOnly) return;
    const target = { nodeId: id, socketName, isOutput };
    if (wireRef.current) {
      connect(target);
      return;
    }
    const outgoing = connections.filter(
      (c) => c.fromNodeId === id && c.fromSocket === socketName,
    );
    const selectedConnection = outgoing.find((c) =>
      selectedWires.includes(c.id),
    );
    if (isOutput && !branch && outgoing.length > 1 && !selectedConnection) {
      onCopyNotice('Select the wire to move, or Shift-drag to create a branch');
      return;
    }
    const existing = !isOutput
      ? connections.find((c) => c.toNodeId === id && c.toSocket === socketName)
      : !branch
        ? selectedConnection || outgoing[0]
        : undefined;
    const point = world(x, y);
    setSelected([]);
    setSelectedWires(existing ? [existing.id] : []);
    setActiveWire({
      ...(existing
        ? {
            nodeId: isOutput ? existing.toNodeId : existing.fromNodeId,
            socketName: isOutput ? existing.toSocket : existing.fromSocket,
            isOutput: !isOutput,
            wireId: existing.id,
          }
        : target),
      curWorldX: point.x,
      curWorldY: point.y,
      moved: false,
      startClientX: x,
      startClientY: y,
    });
  };
  const filtered = useMemo(
    () =>
      definitions.filter((d) => {
        if (!picker || !matchesNode(d, picker.query)) return false;
        const a = picker.attachment;
        if (!a) return true;
        const sourceNode = nodes.find((n) => n.id === a.nodeId);
        const sourceDef = defs.get(
          sourceNode?.definitionId || sourceNode?.type || '',
        );
        const source = (
          a.isOutput ? sourceDef?.outputs : sourceDef?.inputs
        )?.find((s) => s.name === a.socketName && s.connectable !== false);
        if (!source) return false;
        const sourceCompatible = (a.isOutput ? d.inputs : d.outputs).some(
          (s) =>
            s.connectable !== false &&
            (a.isOutput
              ? compatibleTypes(source.type, s.type)
              : compatibleTypes(s.type, source.type)),
        );
        if (!a.wireId) return sourceCompatible;
        const c = connections.find((c) => c.id === a.wireId);
        const targetNode = nodes.find((n) => n.id === c?.toNodeId);
        const target = defs
          .get(targetNode?.definitionId || targetNode?.type || '')
          ?.inputs.find((s) => s.name === c?.toSocket);
        return (
          sourceCompatible &&
          !!target &&
          d.outputs.some(
            (s) =>
              s.connectable !== false && compatibleTypes(s.type, target.type),
          )
        );
      }),
    [picker, definitions, nodes, defs, connections],
  );
  const spawn = (id: string) => {
    pickerPreview.hide();
    if (!picker) return;
    const newId = onSpawnNode?.(
      id,
      picker.worldX,
      picker.worldY,
      picker.attachment,
    );
    if (newId) setSelected([newId]);
    setPicker(null);
  };
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if (
        blocked ||
        (e.target as HTMLElement).closest(
          'input, textarea, select, [contenteditable="true"]',
        )
      )
        return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Escape') {
        setActiveWire(null);
        setSnapTarget(null);
        setMenu(null);
        setPicker(null);
        setSelected([]);
        setSelectedWires([]);
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        setSpace(true);
        return;
      }
      if (
        (e.key === 'Tab' || e.key.toLowerCase() === 'a') &&
        !mod &&
        !readOnly &&
        !e.altKey &&
        !e.shiftKey
      ) {
        e.preventDefault();
        const rect = containerRef.current!.getBoundingClientRect();
        const p = mouse.current;
        openPicker(
          p?.clientX ?? rect.left + size.width / 2,
          p?.clientY ?? rect.top + size.height / 2,
          p || { x: -pan.x / zoom, y: -pan.y / zoom },
        );
        return;
      }
      if (!mod && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        fit(true);
        return;
      }
      if (e.key === 'Home' || e.key === '0') {
        e.preventDefault();
        onUpdateView({ x: 0, y: 0 }, 1);
        return;
      }
      if (readOnly) return;
      if (mod && e.key.toLowerCase() === 'g' && selected.length > 1) {
        e.preventDefault();
        beginCreation('group');
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selected.length || selectedWires.length) {
          e.preventDefault();
          deleteSelected();
        }
        return;
      }
      if (e.key.startsWith('Arrow') && selected.length) {
        e.preventDefault();
        beginEdit();
        const step = e.altKey
          ? 1
          : e.shiftKey
            ? 10
            : settings.snapToGrid
              ? settings.gridDotSpacing
              : 1;
        mutate(
          (g) => ({
            ...g,
            nodes: g.nodes.map((n) =>
              selected.includes(n.id)
                ? {
                    ...n,
                    x:
                      n.x +
                      (e.key === 'ArrowLeft'
                        ? -step
                        : e.key === 'ArrowRight'
                          ? step
                          : 0),
                    y:
                      n.y +
                      (e.key === 'ArrowUp'
                        ? -step
                        : e.key === 'ArrowDown'
                          ? step
                          : 0),
                  }
                : n,
            ),
          }),
          false,
        );
        return;
      }
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (['a', 'c', 'x', 'v', 'd', 'z', 'y'].includes(key)) e.preventDefault();
      if (key === 'a') {
        setSelected(nodes.map((n) => n.id));
        setSelectedWires([]);
      }
      if (key === 'c') copy();
      if (key === 'x') {
        copy();
        deleteSelected();
      }
      if (key === 'v')
        paste(mouse.current || { x: -pan.x / zoom, y: -pan.y / zoom });
      if (key === 'd') duplicate();
      if (key === 'z') {
        endEdit();
        if (e.shiftKey) onRedo?.();
        else onUndo?.();
      }
      if (key === 'y') {
        endEdit();
        onRedo?.();
      }
    };
    const keyup = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpace(false);
      if (
        e.key.startsWith('Arrow') &&
        !(e.target as HTMLElement).closest('input, textarea, select')
      )
        endEdit();
    };
    const blur = () => {
      setSpace(false);
      panDrag.current = null;
      drag.current = null;
      resize.current = null;
      boxDrag.current = null;
      setMarquee(null);
      setGuides({});
      setActiveWire(null);
      endEdit();
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', blur);
    };
  });
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (blocked || !containerRef.current) return;
      const point = world(e.clientX, e.clientY);
      const rect = containerRef.current.getBoundingClientRect();
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      )
        mouse.current = { ...point, clientX: e.clientX, clientY: e.clientY };
      if (panDrag.current) {
        const d = panDrag.current;
        onUpdateView(
          { x: d.pan.x + e.clientX - d.x, y: d.pan.y + e.clientY - d.y },
          zoom,
        );
        return;
      }
      if (boxDrag.current) {
        const d = boxDrag.current;
        const x = Math.min(d.x, point.x),
          y = Math.min(d.y, point.y),
          width = Math.abs(point.x - d.x),
          height = Math.abs(point.y - d.y);
        setMarquee({ x, y, width, height });
        setSelected([
          ...new Set([
            ...d.initial,
            ...nodes
              .filter((n) => {
                const size = dims(n);
                return (
                  n.x <= x + width &&
                  n.x + size.width >= x &&
                  n.y <= y + height &&
                  n.y + size.height >= y
                );
              })
              .map((n) => n.id),
          ]),
        ]);
        return;
      }
      if (drag.current) {
        const d = drag.current;
        if (
          !d.moved &&
          Math.hypot(e.clientX - d.clientX, e.clientY - d.clientY) < 3
        )
          return;
        d.moved = true;
        let dx = (e.clientX - d.clientX - (pan.x - d.pan.x)) / zoom,
          dy = (e.clientY - d.clientY - (pan.y - d.pan.y)) / zoom;
        const anchor = d.starts.find((n) => n.id === d.anchor)!;
        if (settings.snapToGrid && !e.altKey) {
          dx =
            Math.round((anchor.x + dx) / settings.gridDotSpacing) *
              settings.gridDotSpacing -
            anchor.x;
          dy =
            Math.round((anchor.y + dy) / settings.gridDotSpacing) *
              settings.gridDotSpacing -
            anchor.y;
        }
        const nextGuides: { x?: number; y?: number } = {};
        if (!e.altKey)
          for (const other of nodes.filter(
            (n) => !d.starts.some((s) => s.id === n.id),
          )) {
            if (Math.abs(other.x - anchor.x - dx) < 5 / zoom) {
              dx = other.x - anchor.x;
              nextGuides.x = other.x;
            }
            if (Math.abs(other.y - anchor.y - dy) < 5 / zoom) {
              dy = other.y - anchor.y;
              nextGuides.y = other.y;
            }
          }
        setGuides(nextGuides);
        const starts = new Map(d.starts.map((n) => [n.id, n]));
        const updateNodes = (list: MathNodeInstance[]) =>
          list.map((n) =>
            starts.has(n.id)
              ? {
                  ...n,
                  x: starts.get(n.id)!.x + dx,
                  y: starts.get(n.id)!.y + dy,
                }
              : n,
          );
        if (d.frameStarts.length) {
          const frameMap = new Map(d.frameStarts.map((f) => [f.id, f]));
          mutate(
            (g) => ({
              ...g,
              nodes: updateNodes(g.nodes),
              frames: g.frames?.map((f) =>
                frameMap.has(f.id)
                  ? {
                      ...f,
                      x: frameMap.get(f.id)!.x + dx,
                      y: frameMap.get(f.id)!.y + dy,
                    }
                  : f,
              ),
            }),
            false,
          );
        } else onUpdateNodes?.(updateNodes(nodes), false);
        return;
      }
      if (resize.current) {
        const d = resize.current;
        const min = getNodeMinDimensions(
          d.node,
          defs.get(d.node.definitionId || d.node.type),
        );
        const dx = (e.clientX - d.x) / zoom,
          dy = (e.clientY - d.y) / zoom;
        const left = d.handle.endsWith('l'),
          top = d.handle.startsWith('t');
        const width = Math.max(min.minWidth, d.width + (left ? -dx : dx)),
          height = Math.max(min.minHeight, d.height + (top ? -dy : dy));
        onUpdateNodes?.(
          nodes.map((n) =>
            n.id === d.id
              ? {
                  ...n,
                  width,
                  height,
                  x: d.node.x + (left ? d.width - width : 0),
                  y: d.node.y + (top ? d.height - height : 0),
                }
              : n,
          ),
          false,
        );
        return;
      }
      const active = wireRef.current;
      if (active) {
        const next = {
          ...active,
          curWorldX: point.x,
          curWorldY: point.y,
          moved:
            active.moved ||
            Math.hypot(
              e.clientX - active.startClientX,
              e.clientY - active.startClientY,
            ) > 3,
        };
        setActiveWire(next);
        setSnapTarget(nearest(next, point));
      }
    };
    const up = (e: MouseEvent) => {
      if (e.button !== 0 && e.button !== 1) return;
      panDrag.current = null;
      boxDrag.current = null;
      setMarquee(null);
      if (drag.current || resize.current) {
        drag.current = null;
        resize.current = null;
        setGuides({});
        endEdit();
      }
      const active = wireRef.current;
      if (active?.wireId && !active.moved) {
        setActiveWire(null);
        setSnapTarget(null);
        return;
      }
      if (active?.moved) {
        const point = world(e.clientX, e.clientY);
        const target = nearest(active, point);
        if (target) connect(target);
        else {
          const element = e.target as HTMLElement;
          if (element.closest('[data-socket-name]')) return;
          setActiveWire(null);
          setSnapTarget(null);
          if (
            active.wireId &&
            element.closest('[data-canvas]') &&
            !element.closest(
              '[data-node-id], [data-canvas-menu], [data-minimap]',
            )
          ) {
            mutate((g) => ({
              ...g,
              connections: g.connections.filter((c) => c.id !== active.wireId),
            }));
            onCopyNotice('Disconnected wire');
          }
          if (
            !active.wireId &&
            !element.closest('[data-node-id]') &&
            element.closest('[data-canvas]')
          )
            openPicker(e.clientX, e.clientY, point, active);
        }
      }
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  });
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        disabled ||
        (!drag.current && !wireRef.current) ||
        !mouse.current ||
        !containerRef.current
      )
        return;
      const rect = containerRef.current.getBoundingClientRect(),
        p = mouse.current;
      const dx =
        p.clientX < rect.left + 28 ? 8 : p.clientX > rect.right - 28 ? -8 : 0;
      const dy =
        p.clientY < rect.top + 28 ? 8 : p.clientY > rect.bottom - 28 ? -8 : 0;
      if (dx || dy) {
        onUpdateView({ x: pan.x + dx, y: pan.y + dy }, zoom);
        window.dispatchEvent(
          new MouseEvent('mousemove', {
            clientX: p.clientX,
            clientY: p.clientY,
            buttons: 1,
          }),
        );
      }
    }, 30);
    return () => clearInterval(timer);
  }, [disabled, pan, zoom, onUpdateView]);
  const menuAt = (e: React.MouseEvent, extra: Partial<Menu> = {}) => {
    e.preventDefault();
    e.stopPropagation();
    if (readOnly) return;
    const p = world(e.clientX, e.clientY);
    setPicker(null);
    setActiveWire(null);
    setSnapTarget(null);
    setRename(null);
    setMenu({ x: e.clientX, y: e.clientY, worldX: p.x, worldY: p.y, ...extra });
  };
  const compositeError = useMemo(() => {
    if (!menu?.nodeId && !menu?.frameId) return '';
    const ids = menu.frameId
      ? frames.find((f) => f.id === menu.frameId)?.nodeIds || []
      : selected;
    try {
      createCompositeDefinition(
        { nodes, connections, frames },
        ids,
        definitions,
        'Validation',
      );
      return '';
    } catch (error) {
      return error instanceof Error ? error.message : 'Invalid node selection';
    }
  }, [
    menu?.nodeId,
    menu?.frameId,
    selected,
    nodes,
    connections,
    frames,
    definitions,
  ]);
  const menuAction = (
    label: string,
    action: () => void,
    disabled = false,
    reason?: string,
  ) => (
    <button
      key={label}
      role="menuitem"
      title={reason}
      disabled={disabled}
      className="w-full px-3 py-1.5 text-left text-[12px] hover:bg-[#282832] disabled:opacity-30 disabled:hover:bg-transparent"
      onClick={() => {
        action();
        setMenu(null);
      }}
    >
      {label}
    </button>
  );
  const inspect =
    menu?.socket ||
    (menu?.wireId
      ? (() => {
          const c = connections.find((c) => c.id === menu.wireId);
          return c
            ? { nodeId: c.fromNodeId, socketName: c.fromSocket, isOutput: true }
            : null;
        })()
      : null);
  const inspectConnection =
    inspect && !inspect.isOutput
      ? connections.find(
          (c) =>
            c.toNodeId === inspect.nodeId && c.toSocket === inspect.socketName,
        )
      : null;
  const inspectNode = nodes.find(
    (n) => n.id === (inspectConnection?.fromNodeId || inspect?.nodeId),
  );
  const inspectValue = inspect
    ? inspect.isOutput || inspectConnection
      ? inspectNode?.computedOutputs?.[
          inspectConnection?.fromSocket || inspect.socketName
        ]
      : inspectNode?.values?.[inspect.socketName]
    : undefined;
  return (
    <div
      ref={containerRef}
      data-canvas
      className={`relative flex-1 h-full overflow-clip canvas-grid-bg select-none ${space ? 'cursor-grab' : ''}`}
      style={{
        backgroundPosition: `${center.x}px ${center.y}px`,
        backgroundSize: `${settings.gridDotSpacing * zoom}px ${settings.gridDotSpacing * zoom}px`,
      }}
      onWheel={(e) => {
        if (
          blocked ||
          (e.target as HTMLElement).closest(
            '[data-canvas-menu], [data-scrollable], input, select, pre',
          )
        )
          return;
        const rect = containerRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left - size.width / 2,
          y = e.clientY - rect.top - size.height / 2;
        const next = Math.min(
          3,
          Math.max(0.2, zoom * Math.exp(-e.deltaY * 0.0015)),
        );
        onUpdateView(
          {
            x: x - ((x - pan.x) * next) / zoom,
            y: y - ((y - pan.y) * next) / zoom,
          },
          next,
        );
      }}
      onMouseDown={(e) => {
        if (
          blocked ||
          (e.target as HTMLElement).closest(
            '[data-canvas-menu], [data-minimap]',
          )
        )
          return;
        if (e.button === 1 || (e.button === 0 && space)) {
          e.preventDefault();
          panDrag.current = { x: e.clientX, y: e.clientY, pan };
          return;
        }
        if (
          e.button === 0 &&
          !(e.target as HTMLElement).closest('[data-node-id], [data-wire-id]')
        ) {
          if (wireRef.current) {
            setActiveWire(null);
            setSnapTarget(null);
            return;
          }
          const p = world(e.clientX, e.clientY);
          boxDrag.current = {
            ...p,
            initial: e.shiftKey || e.ctrlKey || e.metaKey ? selected : [],
          };
          if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
            setSelected([]);
            setSelectedWires([]);
          }
        }
      }}
      onDoubleClick={(e) => {
        if (
          !blocked &&
          !readOnly &&
          !(e.target as HTMLElement).closest(
            '[data-node-id], [data-wire-id], button, input, [data-canvas-menu], [data-minimap]',
          )
        )
          openPicker(e.clientX, e.clientY, world(e.clientX, e.clientY));
      }}
      onContextMenu={(e) => {
        if (!blocked) menuAt(e);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (blocked || readOnly) return;
        const id = e.dataTransfer.getData('application/mathnode-def');
        if (id) {
          const p = world(e.clientX, e.clientY);
          onSpawnNode?.(id, p.x, p.y);
        } else if (e.dataTransfer.files[0]) onFileDrop(e.dataTransfer.files[0]);
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate(${center.x}px, ${center.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <ConnectionWires
          nodes={nodes}
          connections={connections}
          definitions={definitions}
          activeDragWire={wire}
          selectedWireIds={selectedWires}
          onSelect={selectWire}
          wireThickness={settings.wireThickness}
          onContextMenu={(e, id) => {
            setSelected([]);
            setSelectedWires((previous) =>
              previous.includes(id) ? previous : [id],
            );
            menuAt(e, { wireId: id });
          }}
        />
        {frames.map((f) => (
          <div
            key={f.id}
            data-frame-id={f.id}
            className="absolute border border-dashed rounded-md"
            style={{
              left: f.x,
              top: f.y,
              width: f.width,
              height: f.height,
              borderColor: f.color,
              backgroundColor: `${f.color}08`,
            }}
          >
            <div
              data-frame-header
              className="absolute top-0 left-0 right-0 h-8 px-3 flex items-center gap-2 text-xs text-[#A3A3AD] pointer-events-auto cursor-grab"
              onContextMenu={(e) => menuAt(e, { frameId: f.id })}
              onMouseDown={(e) => {
                if (blocked || readOnly || e.button !== 0 || space) return;
                e.stopPropagation();
                const members = nodes.filter((n) =>
                  f.nodeIds
                    ? f.nodeIds.includes(n.id)
                    : n.x >= f.x &&
                      n.y >= f.y &&
                      n.x <= f.x + f.width &&
                      n.y <= f.y + f.height,
                );
                setSelected(members.map((n) => n.id));
                setSelectedWires([]);
                if (!members.length) return;
                beginEdit();
                drag.current = {
                  clientX: e.clientX,
                  clientY: e.clientY,
                  pan,
                  starts: members,
                  frameStarts: [f],
                  anchor: members[0].id,
                  moved: false,
                };
              }}
            >
              <span className="font-mono truncate">{f.title}</span>
              <span className="text-[10px]">{f.nodeIds?.length || ''}</span>
            </div>
          </div>
        ))}
        {marquee && (
          <div
            className="absolute border border-[#4B78D8] bg-blue-500/10 z-40"
            style={{
              left: marquee.x,
              top: marquee.y,
              width: marquee.width,
              height: marquee.height,
            }}
          />
        )}
        {guides.x !== undefined && (
          <div
            className="absolute bg-[#4B78D8]"
            style={{
              left: guides.x,
              top: -100000,
              width: 1 / zoom,
              height: 200000,
            }}
          />
        )}
        {guides.y !== undefined && (
          <div
            className="absolute bg-[#4B78D8]"
            style={{
              top: guides.y,
              left: -100000,
              height: 1 / zoom,
              width: 200000,
            }}
          />
        )}
        {nodes.map((node) => (
          <div
            key={node.id}
            className="absolute pointer-events-auto cursor-grab"
            style={{
              transform: `translate(${node.x}px, ${node.y}px)`,
              zIndex: selected.includes(node.id) ? 25 : 10,
            }}
            onContextMenu={(e) => {
              if (!selected.includes(node.id)) setSelected([node.id]);
              setSelectedWires([]);
              menuAt(e, { nodeId: node.id });
            }}
            onMouseDown={(e) => {
              if (
                blocked ||
                e.button !== 0 ||
                space ||
                (e.target as HTMLElement).closest(
                  'input, select, textarea, button, [data-socket-name]',
                )
              )
                return;
              e.stopPropagation();
              const toggle = e.shiftKey || e.ctrlKey || e.metaKey;
              const next = toggle
                ? selected.includes(node.id)
                  ? selected.filter((id) => id !== node.id)
                  : [...selected, node.id]
                : selected.includes(node.id)
                  ? selected
                  : [node.id];
              setSelected(next);
              setSelectedWires([]);
              if (readOnly || toggle) return;
              beginEdit();
              drag.current = {
                clientX: e.clientX,
                clientY: e.clientY,
                pan,
                starts: nodes.filter((n) => next.includes(n.id)),
                frameStarts: frames.filter(
                  (f) =>
                    f.nodeIds?.length &&
                    f.nodeIds.every((id) => next.includes(id)),
                ),
                anchor: node.id,
                moved: false,
              };
            }}
          >
            <MathNodeCard
              node={node}
              readOnly={readOnly}
              onInspect={() => onInspectNode?.(node)}
              definition={defs.get(node.definitionId || node.type)}
              isSelected={selected.includes(node.id)}
              connections={connections}
              allNodes={nodes}
              precision={settings.precision || 6}
              onNotice={onCopyNotice}
              onBeginEdit={beginEdit}
              onEndEdit={endEdit}
              onToggleCollapse={toggleCollapse}
              onUpdateValues={(id, values) =>
                mutate(
                  (g) => ({
                    ...g,
                    nodes: g.nodes.map((n) =>
                      n.id === id ? { ...n, values } : n,
                    ),
                  }),
                  false,
                )
              }
              onUpdateTitle={updateTitle}
              onDeleteNode={(id) =>
                mutate((g) => ({
                  nodes: g.nodes.filter((n) => n.id !== id),
                  connections: g.connections.filter(
                    (c) => c.fromNodeId !== id && c.toNodeId !== id,
                  ),
                }))
              }
              onDuplicateNode={(id) => duplicate([id])}
              onStartConnection={startWire}
              onEndConnection={(id, name, output) => {
                if (wireRef.current?.moved)
                  connect({ nodeId: id, socketName: name, isOutput: output });
              }}
              onSocketMenu={(e, nodeId, socketName, isOutput) =>
                menuAt(e, { socket: { nodeId, socketName, isOutput } })
              }
              snapTarget={snapTarget}
              compatibleSocket={
                wire
                  ? (id, name, output) =>
                      compatible(wire, {
                        nodeId: id,
                        socketName: name,
                        isOutput: output,
                      })
                  : undefined
              }
              onResizeStart={(e, id, handle) => {
                if (readOnly) return;
                setSelectedWires([]);
                e.stopPropagation();
                e.preventDefault();
                beginEdit();
                const size = dims(node);
                resize.current = {
                  id,
                  handle,
                  x: e.clientX,
                  y: e.clientY,
                  node,
                  ...size,
                };
              }}
            />
          </div>
        ))}
      </div>
      {settings.showMinimap && (
        <div
          data-minimap
          onMouseDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <NavigatorMinimap
            zoom={zoom}
            pan={pan}
            nodes={nodes.map((n) => ({ ...n, ...dims(n) }))}
            frames={frames}
            containerWidth={size.width}
            containerHeight={size.height}
            onPanChange={(p) => onUpdateView(p, zoom)}
            onZoomIn={() => onUpdateView(pan, Math.min(3, zoom * 1.15))}
            onZoomOut={() => onUpdateView(pan, Math.max(0.2, zoom / 1.15))}
            onResetView={() => fit()}
          />
        </div>
      )}
      {picker && (
        <div
          data-canvas-menu
          data-node-preview-surface
          role="dialog"
          aria-label="Add node"
          className="fixed z-50 w-72 rounded-xl border border-[#363640] bg-[#1E1E22] shadow-xl overflow-hidden"
          style={{
            left: Math.max(8, Math.min(picker.x, window.innerWidth - 296)),
            top: Math.max(8, Math.min(picker.y, window.innerHeight - 340)),
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="flex gap-2 items-center px-3 py-2 border-b border-[#2B2B32]">
            <Search size={14} />
            <input
              autoFocus
              aria-label="Search nodes"
              role="combobox"
              aria-expanded="true"
              aria-controls="node-picker-list"
              aria-describedby={
                pickerPreview.target ? pickerPreview.id : undefined
              }
              aria-activedescendant={
                filtered[pickerIndex]
                  ? `picker-${filtered[pickerIndex].id}`
                  : undefined
              }
              className="bg-transparent outline-none w-full text-xs"
              placeholder={
                picker.attachment ? 'Add compatible node…' : 'Search nodes…'
              }
              value={picker.query}
              onChange={(e) => {
                pickerPreview.hide();
                setPicker({ ...picker, query: e.target.value });
                setPickerIndex(0);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') setPicker(null);
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  const next = Math.max(
                    0,
                    Math.min(
                      filtered.length - 1,
                      pickerIndex + (e.key === 'ArrowDown' ? 1 : -1),
                    ),
                  );
                  setPickerIndex(next);
                  const selected = filtered[next];
                  const anchor = selected
                    ? document.getElementById(`picker-${selected.id}`)
                    : null;
                  if (selected && anchor)
                    pickerPreview.show(selected, anchor, true);
                  document
                    .getElementById(`picker-${filtered[next]?.id}`)
                    ?.scrollIntoView({ block: 'nearest' });
                }
                if (e.key === 'Enter' && filtered[pickerIndex])
                  spawn(filtered[pickerIndex].id);
              }}
            />
            <button
              aria-label="Close node picker"
              onClick={() => setPicker(null)}
            >
              <X size={13} />
            </button>
          </div>
          <div
            id="node-picker-list"
            data-node-preview-list
            role="listbox"
            className="max-h-64 overflow-y-auto py-1"
          >
            {filtered.map((def, i) => (
              <button
                role="option"
                aria-selected={i === pickerIndex}
                id={`picker-${def.id}`}
                key={def.id}
                className={`w-full px-3 py-2 flex gap-2 text-left items-center ${i === pickerIndex ? 'bg-[#2A2A33]' : 'hover:bg-[#25252B]'}`}
                aria-describedby={
                  pickerPreview.target?.definition.id === def.id
                    ? pickerPreview.id
                    : undefined
                }
                onMouseEnter={(e) => {
                  setPickerIndex(i);
                  pickerPreview.show(def, e.currentTarget);
                }}
                onMouseLeave={pickerPreview.hideSoon}
                onFocus={(e) => {
                  setPickerIndex(i);
                  pickerPreview.show(def, e.currentTarget, true);
                }}
                onBlur={pickerPreview.hideSoon}
                onClick={() => spawn(def.id)}
              >
                <MathIcon name={def.icon || 'function'} size={14} />
                <div className="min-w-0">
                  <div className="text-xs truncate">{def.name}</div>
                  <div className="text-[10px] text-[#8E8E96] truncate">
                    {def.category || 'Custom'}
                  </div>
                </div>
              </button>
            ))}
            {!filtered.length && (
              <div className="p-5 text-xs text-[#8E8E96]">
                No compatible nodes match this search.
              </div>
            )}
          </div>
        </div>
      )}
      {menu && (
        <div
          data-canvas-menu
          role="menu"
          className="fixed z-50 w-56 max-h-[80vh] overflow-y-auto py-1 rounded-lg border border-[#363640] bg-[#1E1E22] shadow-xl"
          style={{
            left: Math.max(8, Math.min(menu.x, window.innerWidth - 232)),
            top: Math.max(
              8,
              Math.min(menu.y, window.innerHeight - (menu.nodeId ? 430 : 260)),
            ),
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {menu.nodeId ? (
            <>
              <div className="px-3 py-1 text-[10px] text-[#8E8E96]">
                {selected.length === 1
                  ? nodes.find((n) => n.id === menu.nodeId)?.title
                  : `${selected.length} nodes selected`}
              </div>
              {selected.length === 1 &&
                (rename !== null ? (
                  <input
                    autoFocus
                    aria-label="Rename node"
                    className="m-2 w-[90%] bg-[#141417] px-2 py-1 text-xs"
                    value={rename}
                    onChange={(e) => setRename(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter' && rename.trim()) {
                        updateTitle(menu.nodeId!, rename.trim());
                        setMenu(null);
                      }
                      if (e.key === 'Escape') setMenu(null);
                    }}
                  />
                ) : (
                  <button
                    className="w-full px-3 py-1.5 text-left text-xs hover:bg-[#282832]"
                    onClick={() =>
                      setRename(
                        nodes.find((n) => n.id === menu.nodeId)?.title || '',
                      )
                    }
                  >
                    Rename…
                  </button>
                ))}
              {selected.length === 1 &&
                onInspectNode &&
                definitions.find(
                  (d) =>
                    d.id ===
                    (nodes.find((n) => n.id === menu.nodeId)?.definitionId ||
                      nodes.find((n) => n.id === menu.nodeId)?.type),
                )?.composite &&
                menuAction('Open Node Contents', () =>
                  onInspectNode(nodes.find((n) => n.id === menu.nodeId)!),
                )}
              {selected.length > 1 &&
                menuAction('Make Group', () => beginCreation('group'))}
              {selected.length > 1 &&
                onCreateComposite &&
                menuAction(
                  'Make Node',
                  () => beginCreation('node'),
                  !!compositeError,
                  compositeError,
                )}
              {menuAction('Duplicate', () => duplicate())}
              {menuAction('Copy', copy)}
              {menuAction('Cut', () => {
                copy();
                deleteSelected();
              })}
              {menuAction('Delete', deleteSelected)}
              {connections.some(
                (c) =>
                  selected.includes(c.fromNodeId) ||
                  selected.includes(c.toNodeId),
              ) && menuAction('Disconnect Wires', disconnect)}
              {selected.length > 1 &&
                menuAction('Frame Selection', () => fit(true))}
              {menuAction(
                selected.length === 1
                  ? nodes.find((n) => n.id === menu.nodeId)?.collapsed
                    ? 'Expand'
                    : 'Collapse'
                  : nodes
                        .filter((n) => selected.includes(n.id))
                        .every((n) => n.collapsed)
                    ? 'Expand Selection'
                    : 'Collapse Selection',
                () => {
                  const collapse = !nodes
                    .filter((n) => selected.includes(n.id))
                    .every((n) => n.collapsed);
                  mutate((g) => ({
                    ...g,
                    nodes: g.nodes.map((n) =>
                      selected.includes(n.id)
                        ? { ...n, collapsed: collapse }
                        : n,
                    ),
                  }));
                },
              )}
            </>
          ) : menu.frameId ? (
            <>
              {rename !== null ? (
                <input
                  autoFocus
                  aria-label="Group name"
                  className="m-2 w-[90%] bg-[#141417] px-2 py-1 text-xs"
                  value={rename}
                  onChange={(e) => setRename(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Escape') setMenu(null);
                    if (e.key === 'Enter' && rename.trim()) {
                      mutate((g) => ({
                        ...g,
                        frames: g.frames?.map((f) =>
                          f.id === menu.frameId
                            ? { ...f, title: rename.trim() }
                            : f,
                        ),
                      }));
                      setMenu(null);
                    }
                  }}
                />
              ) : (
                <button
                  className="w-full px-3 py-1.5 text-left text-xs hover:bg-[#282832]"
                  onClick={() =>
                    setRename(
                      frames.find((f) => f.id === menu.frameId)?.title || '',
                    )
                  }
                >
                  Rename Group
                </button>
              )}
              {menuAction('Select Group', () => {
                setSelected(
                  frames.find((f) => f.id === menu.frameId)?.nodeIds || [],
                );
                setSelectedWires([]);
              })}
              {onCreateComposite &&
                (frames.find((f) => f.id === menu.frameId)?.nodeIds?.length ||
                  0) > 1 &&
                menuAction(
                  'Make Node',
                  () =>
                    beginCreation(
                      'node',
                      frames.find((f) => f.id === menu.frameId)?.nodeIds || [],
                    ),
                  !!compositeError,
                  compositeError,
                )}
              {menuAction('Ungroup', () =>
                mutate((g) => ({
                  ...g,
                  frames: g.frames?.filter((f) => f.id !== menu.frameId),
                })),
              )}
            </>
          ) : menu.socket || menu.wireId ? (
            <>
              <pre className="px-3 py-2 max-h-28 overflow-auto text-[11px] font-mono text-[#34D399] whitespace-pre-wrap">
                {inspectNode?.error ||
                  formatValue(inspectValue, settings.precision || 6)}
              </pre>
              {menu.wireId &&
                menuAction('Copy', () => copyWires([menu.wireId!]))}
              {menuAction(
                'Disconnect',
                () =>
                  mutate((g) => ({
                    ...g,
                    connections: g.connections.filter((c) =>
                      menu.wireId
                        ? c.id !== menu.wireId
                        : menu.socket!.isOutput
                          ? !(
                              c.fromNodeId === menu.socket!.nodeId &&
                              c.fromSocket === menu.socket!.socketName
                            )
                          : !(
                              c.toNodeId === menu.socket!.nodeId &&
                              c.toSocket === menu.socket!.socketName
                            ),
                    ),
                  })),
                !menu.wireId &&
                  !connections.some((c) =>
                    menu.socket!.isOutput
                      ? c.fromNodeId === menu.socket!.nodeId &&
                        c.fromSocket === menu.socket!.socketName
                      : c.toNodeId === menu.socket!.nodeId &&
                        c.toSocket === menu.socket!.socketName,
                  ),
              )}
              {menuAction(
                menu.wireId ? 'Insert Node…' : 'Add Compatible Node…',
                () =>
                  openPicker(
                    menu.x,
                    menu.y,
                    { x: menu.worldX, y: menu.worldY },
                    { ...inspect!, wireId: menu.wireId },
                  ),
              )}
            </>
          ) : (
            <>
              {menuAction('Add Node…', () =>
                openPicker(menu.x, menu.y, { x: menu.worldX, y: menu.worldY }),
              )}
              {menuAction(
                'Paste Here',
                () => paste({ x: menu.worldX, y: menu.worldY }),
                clipboardMode === 'nodes'
                  ? !graphClipboard
                  : !wireClipboard?.length,
              )}
              {menuAction(
                'Select All',
                () => setSelected(nodes.map((n) => n.id)),
                !nodes.length,
              )}
              {menuAction('Fit Graph', () => fit(), !nodes.length)}
              {menuAction('Open Node Library', onOpenNodeLibrary)}
            </>
          )}
        </div>
      )}
      {picker && pickerPreview.target && (
        <NodePreview
          {...pickerPreview.target}
          id={pickerPreview.id}
          onDismiss={pickerPreview.hide}
          onEnter={pickerPreview.cancelClose}
          onLeave={pickerPreview.hideSoon}
        />
      )}
      {creation && (
        <CreateSelectionModal
          mode={creation.mode}
          ids={creation.ids}
          graph={creation.graph}
          definitions={definitions}
          onClose={() => setCreation(null)}
          onCreate={finishCreation}
        />
      )}
    </div>
  );
};
