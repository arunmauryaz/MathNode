import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Boxes } from 'lucide-react';
import { MathNodeCard } from './MathNodeCard';
import { NodeSocketDef, MathNodeInstance } from '../../types';
import { getNodeMinDimensions } from '../../utils/socketGeometry';
import { formatValue, SOCKET_COLORS } from '../../utils/graphRules';
import { PreviewTarget } from '../../hooks/useNodePreview';
const noop = () => {};
interface Props extends PreviewTarget {
  id: string;
  onDismiss: () => void;
  onEnter: () => void;
  onLeave: () => void;
}
export function NodePreview({
  definition,
  anchor,
  id,
  onDismiss,
  onEnter,
  onLeave,
}: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    side: 'left' | 'right';
    ready: boolean;
  }>({ left: 0, top: 0, side: 'right', ready: false });
  const node = useMemo<MathNodeInstance>(
    () => ({
      id: `preview-${definition.id}`,
      type: definition.id,
      definitionId: definition.id,
      title: definition.name,
      x: 0,
      y: 0,
      values: {
        ...(definition.id === 'math.value' ? { value: 10 } : {}),
        ...Object.fromEntries(
          definition.inputs
            .filter((s) => s.default !== undefined)
            .map((s) => [s.name, structuredClone(s.default)]),
        ),
      },
      computedOutputs: {},
    }),
    [definition],
  );
  const dimensions = getNodeMinDimensions(node, definition);
  const inputs = definition.inputs.filter((s) => s.connectable !== false),
    controls = definition.inputs.filter((s) => s.connectable === false),
    outputs = definition.outputs.filter((s) => s.connectable !== false);
  const width = Math.min(324, window.innerWidth - 16);
  const scale = Math.min(
    1,
    (width - 44) / dimensions.minWidth,
    210 / dimensions.minHeight,
  );
  useLayoutEffect(() => {
    const place = () => {
      if (!anchor.isConnected || !panel.current) {
        onDismiss();
        return;
      }
      const rect = anchor.getBoundingClientRect(),
        clip = anchor
          .closest('[data-node-preview-list]')
          ?.getBoundingClientRect();
      if (
        !rect.width ||
        rect.bottom < 0 ||
        rect.top > window.innerHeight ||
        (clip && (rect.bottom < clip.top || rect.top > clip.bottom))
      ) {
        onDismiss();
        return;
      }
      const bounds = panel.current.getBoundingClientRect(),
        gap = 10;
      const surface =
        anchor
          .closest('[data-node-preview-surface]')
          ?.getBoundingClientRect() || rect;
      const fitsRight =
        surface.right + gap + bounds.width <= window.innerWidth - 8;
      const side = fitsRight ? 'right' : 'left';
      const left = Math.max(
        8,
        Math.min(
          window.innerWidth - bounds.width - 8,
          fitsRight ? surface.right + gap : surface.left - bounds.width - gap,
        ),
      );
      const top = Math.max(
        8,
        Math.min(rect.top - 12, window.innerHeight - bounds.height - 8),
      );
      setPosition({ left, top, side, ready: true });
    };
    place();
    const observer = new ResizeObserver(place);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, definition, onDismiss]);
  const sockets = (title: string, items: NodeSocketDef[]) => (
    <section aria-label={title} className="space-y-2">
      <h4 className="text-[9px] uppercase tracking-wider font-semibold text-[#8E8E96]">
        {title} <span className="font-mono text-[#686872]">{items.length}</span>
      </h4>
      {items.length ? (
        items.map((socket) => (
          <div key={socket.name} className="text-[11px]">
            <div className="flex items-start gap-2">
              <span
                className="mt-1 w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: SOCKET_COLORS[socket.type] }}
              />
              <span className="text-[#EDEDED] break-words flex-1 min-w-0">
                {socket.label || socket.name}
              </span>
              <span className="text-[10px] font-mono text-[#8E8E96]">
                {socket.type}
              </span>
            </div>
            {socket.description && (
              <p className="pl-3.5 text-[10px] text-[#8E8E96] leading-relaxed">
                {socket.description}
              </p>
            )}
            {socket.default !== undefined && (
              <div className="pl-3.5 text-[10px] text-[#686872]">
                Default{' '}
                <span className="font-mono whitespace-pre-wrap break-words text-[#A3A3AD]">
                  {formatValue(socket.default)}
                </span>
              </div>
            )}
            {socket.options?.length ? (
              <p className="pl-3.5 text-[10px] text-[#686872] leading-relaxed break-words">
                {socket.options.join(' · ')}
              </p>
            ) : null}
          </div>
        ))
      ) : (
        <p className="text-[10px] text-[#686872]">None</p>
      )}
    </section>
  );
  return createPortal(
    <div
      ref={panel}
      id={id}
      role="tooltip"
      aria-label={`${definition.name} preview`}
      data-node-preview
      data-canvas-menu
      data-placement={position.side}
      className="fixed z-[80] rounded-xl border border-[#363640] bg-[#1E1E22] shadow-[0_2px_0_#141417,0_12px_28px_#0008] text-[#EDEDED] select-text overflow-hidden flex flex-col"
      style={{
        left: position.left,
        top: position.top,
        width,
        maxHeight: 'min(620px, calc(100vh - 16px))',
        visibility: position.ready ? 'visible' : 'hidden',
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="px-3.5 py-2.5 flex items-center justify-between gap-3 border-b border-[#2B2B32] shrink-0">
        <span className="text-[11px] font-semibold">{definition.name}</span>
        <span className="text-[9px] uppercase tracking-wide text-[#8E8E96]">
          Node preview
        </span>
      </div>
      <div
        data-scrollable
        className="overflow-y-auto overscroll-contain min-h-0"
      >
        <div
          aria-hidden="true"
          className="p-3.5 bg-[#161616] border-b border-[#2B2B32]"
          {...{ inert: '' }}
        >
          <div
            className="relative mx-auto pointer-events-none"
            style={{
              width: dimensions.minWidth * scale,
              height: dimensions.minHeight * scale,
            }}
          >
            <div
              style={{
                width: dimensions.minWidth,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            >
              <MathNodeCard
                preview
                node={node}
                definition={definition}
                isSelected={false}
                connections={[]}
                onUpdateValues={noop}
                onToggleCollapse={noop}
                onDeleteNode={noop}
                onStartConnection={noop}
                onEndConnection={noop}
                onSocketMenu={noop}
                onBeginEdit={noop}
                onEndEdit={noop}
                onNotice={noop}
                precision={6}
              />
            </div>
          </div>
        </div>
        <div className="p-3.5 space-y-3.5">
          <div className="space-y-1.5">
            <p className="text-[10px] text-[#8E8E96]">
              {definition.category || 'Custom'}
            </p>
            <p className="text-[11px] leading-relaxed text-[#B6B6BF]">
              {definition.description || 'Custom mathematical node.'}
            </p>
            {definition.composite && (
              <p className="flex gap-1.5 items-center text-[10px] text-[#8E8E96]">
                <Boxes size={12} />
                <span>
                  Created node ·{' '}
                  <span className="font-mono">
                    {definition.composite.nodes.length}
                  </span>{' '}
                  internal nodes
                </span>
              </p>
            )}
          </div>
          <div className="border-t border-[#2B2B32] pt-3 space-y-3.5">
            {sockets('Inputs', inputs)}
            {sockets('Outputs', outputs)}
            {controls.length > 0 && sockets('Controls', controls)}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
