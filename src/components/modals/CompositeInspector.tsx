import { useMemo, useState } from 'react';
import { Boxes, ChevronLeft, X } from 'lucide-react';
import { AppSettings, MathNodeInstance, NodeDefinition } from '../../types';
import { WorkspaceCanvas, getNodeGroupBounds } from '../layout/WorkspaceCanvas';
import { getNodeMinDimensions } from '../../utils/socketGeometry';
interface Entry {
  definition: NodeDefinition;
  node: MathNodeInstance;
}
export function CompositeInspector({
  definition,
  node,
  settings,
  onClose,
  onNotice,
}: Entry & {
  settings: AppSettings;
  onClose: () => void;
  onNotice: (message: string) => void;
}) {
  const [trail, setTrail] = useState<Entry[]>([{ definition, node }]);
  const active =
    trail.length === 1 ? { definition, node } : trail[trail.length - 1];
  const graph = active.node.computedGraph || active.definition.composite!;
  const nodes = useMemo(
    () => graph.nodes.map((n) => ({ ...n, collapsed: false })),
    [graph.nodes],
  );
  const initialView = useMemo(() => {
    const bounds = getNodeGroupBounds(
      nodes.map((n) => {
        const min = getNodeMinDimensions(
          n,
          active.definition.composite!.definitions.find(
            (d) => d.id === (n.definitionId || n.type),
          ),
        );
        return {
          ...n,
          width: Math.max(n.width || 260, min.minWidth),
          height: Math.max(n.height || min.minHeight, min.minHeight),
        };
      }),
    );
    if (!bounds) return { pan: { x: 0, y: 0 }, zoom: 1 };
    const zoom = Math.min(
      1,
      Math.max(
        0.2,
        Math.min(
          (Math.min(window.innerWidth - 100, 1240) - 100) / bounds.width,
          (window.innerHeight - 260) / bounds.height,
        ),
      ),
    );
    return {
      pan: { x: -bounds.centerX * zoom, y: -bounds.centerY * zoom },
      zoom,
    };
  }, [nodes, active.definition]);
  const [view, setView] = useState<{
    pan: { x: number; y: number };
    zoom: number;
  } | null>(null);
  const effectiveView = view || initialView;
  const navigate = (entries: Entry[]) => {
    setTrail(entries);
    setView(null);
  };
  return (
    <div
      className="fixed inset-0 z-[65] bg-black/70 flex items-center justify-center p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`Inside ${active.definition.name}`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="mathnode-modal w-[1280px] max-w-full h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 bg-[#27272E] border-b border-[#363640] shrink-0">
          {trail.length > 1 && (
            <button
              aria-label="Back to parent node"
              onClick={() => navigate(trail.slice(0, -1))}
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <Boxes size={16} />
          <div className="text-sm font-semibold flex-1 truncate">
            {trail.map((entry) => entry.definition.name).join(' / ')}
          </div>
          <span className="text-[11px] text-[#8E8E96]">Read-only contents</span>
          <button aria-label="Close node contents" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="px-4 py-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-[#8E8E96] border-b border-[#363640]">
          <span>
            Inputs:{' '}
            {active.definition.inputs
              .map((s) => s.label || s.name)
              .join(', ') || 'None'}
          </span>
          <span>
            Outputs:{' '}
            {active.definition.outputs.map((s) => s.label || s.name).join(', ')}
          </span>
          <span className="font-mono">{nodes.length} internal nodes</span>
        </div>
        <WorkspaceCanvas
          key={trail.map((entry) => entry.node.id).join('/')}
          readOnly
          graphTitle={active.definition.name}
          nodes={nodes}
          connections={graph.connections}
          frames={graph.frames}
          definitions={active.definition.composite!.definitions}
          pan={effectiveView.pan}
          zoom={effectiveView.zoom}
          settings={{ ...settings, showMinimap: true }}
          saveStatus="Read-only internal graph"
          onUpdateView={(pan, zoom) => setView({ pan, zoom })}
          onCommitHistory={() => {}}
          onOpenNodeLibrary={() => {}}
          onFileDrop={() => {}}
          onCopyNotice={onNotice}
          onInspectNode={(child) => {
            const childDef = active.definition.composite!.definitions.find(
              (d) => d.id === (child.definitionId || child.type),
            );
            if (childDef?.composite)
              navigate([...trail, { definition: childDef, node: child }]);
          }}
        />
      </div>
    </div>
  );
}
