import React from 'react';
import { NodeConnection, MathNodeInstance, NodeDefinition } from '../../types';
import { SOCKET_COLORS } from '../../utils/graphRules';
import { getSocketWorldCenter } from '../../utils/socketGeometry';

interface ConnectionWiresProps {
  connections: NodeConnection[];
  nodes: MathNodeInstance[];
  definitions: NodeDefinition[];
  activeDragWire: {
    nodeId: string;
    socketName: string;
    isOutput: boolean;
    curWorldX: number;
    curWorldY: number;
    wireId?: string;
  } | null;
  wireThickness?: 'normal' | 'bold' | 'thick';
  selectedWireIds: string[];
  onSelect: (event: React.MouseEvent, id: string) => void;
  onContextMenu: (event: React.MouseEvent, id: string) => void;
}

export const ConnectionWires: React.FC<ConnectionWiresProps> = ({
  connections,
  nodes,
  definitions,
  activeDragWire,
  wireThickness = 'bold',
  onContextMenu,
  onSelect,
  selectedWireIds,
}) => {
  const nodeMap = new Map<string, MathNodeInstance>();
  for (const n of nodes) nodeMap.set(n.id, n);

  const defMap = new Map<string, NodeDefinition>();
  for (const d of definitions) defMap.set(d.id, d);

  // Wire stroke width based on setting (defaults to bold 3.5px)
  const coreStrokeWidth =
    wireThickness === 'normal' ? 2.5 : wireThickness === 'thick' ? 5.0 : 3.5;
  const haloStrokeWidth = coreStrokeWidth + 4.5;

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-10">
      {/* 1. Established Connections */}
      {connections.map((conn) => {
        if (conn.id === activeDragWire?.wireId) return null;
        const selected = selectedWireIds.includes(conn.id);
        const fromNode = nodeMap.get(conn.fromNodeId);
        const toNode = nodeMap.get(conn.toNodeId);
        if (!fromNode || !toNode) return null;

        const fromDef = defMap.get(fromNode.definitionId || fromNode.type);
        const toDef = defMap.get(toNode.definitionId || toNode.type);

        const fromPos = getSocketWorldCenter(
          fromNode,
          conn.fromSocket,
          true,
          fromDef,
        );
        const toPos = getSocketWorldCenter(toNode, conn.toSocket, false, toDef);

        let pathData = '';
        if (toPos.x >= fromPos.x) {
          // Standard left-to-right flow
          const dx = Math.max(35, Math.min(180, (toPos.x - fromPos.x) * 0.5));
          pathData = `M ${fromPos.x} ${fromPos.y} C ${fromPos.x + dx} ${fromPos.y}, ${toPos.x - dx} ${toPos.y}, ${toPos.x} ${toPos.y}`;
        } else {
          // Backward / feedback connection
          const dx = Math.max(
            50,
            Math.min(150, (fromPos.x - toPos.x) * 0.35 + 45),
          );
          pathData = `M ${fromPos.x} ${fromPos.y} C ${fromPos.x + dx} ${fromPos.y}, ${toPos.x - dx} ${toPos.y}, ${toPos.x} ${toPos.y}`;
        }

        const broken =
          !!fromNode.error || !!toNode.errorConnectionIds?.includes(conn.id);
        const wireError = fromNode.error || (broken ? toNode.error : null);
        const wireColor = broken
          ? '#EF4444'
          : SOCKET_COLORS[
              fromDef?.outputs.find((s) => s.name === conn.fromSocket)?.type ||
                'scalar'
            ];

        return (
          <g
            key={conn.id}
            data-wire-id={conn.id}
            data-wire-selected={selected}
            data-wire-error={broken || undefined}
            role="button"
            aria-label={`Wire from ${fromNode.title} ${conn.fromSocket} to ${toNode.title} ${conn.toSocket}`}
            aria-pressed={selected}
            tabIndex={0}
            className="group/wire cursor-pointer pointer-events-auto"
            style={{ outline: 'none' }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(e, conn.id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onSelect(e as unknown as React.MouseEvent, conn.id);
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onContextMenu(e, conn.id);
            }}
          >
            {/* Wider transparent hit area for easy hover and right-click to delete */}
            <path
              d={pathData}
              fill="none"
              stroke="transparent"
              strokeWidth="20"
            >
              <title>
                {wireError
                  ? `Error: ${wireError}`
                  : 'Click to select; Delete to disconnect; right-click for actions'}
              </title>
            </path>

            {selected && (
              <path
                data-wire-outline
                d={pathData}
                fill="none"
                stroke="#4B78D8"
                strokeWidth={coreStrokeWidth + 6}
                strokeOpacity={0.85}
                strokeLinecap="round"
              />
            )}
            {/* Hover disconnect glow (only visible on hover, zero latency, no shadow lag) */}
            <path
              d={pathData}
              fill="none"
              stroke={wireColor}
              strokeWidth={haloStrokeWidth}
              strokeOpacity="0"
              className="group-hover/wire:stroke-opacity-40 transition-[stroke-opacity] duration-150"
            />

            {/* Clean, bold solid stroke (instant tracking on drag, zero ghosting) */}
            <path
              d={pathData}
              fill="none"
              stroke={wireColor}
              strokeWidth={coreStrokeWidth}
              strokeLinecap="round"
              className="group-hover/wire:brightness-125 transition-colors"
            />
          </g>
        );
      })}

      {/* 2. Interactive Wire Being Dragged by User */}
      {activeDragWire &&
        (() => {
          const startNode = nodeMap.get(activeDragWire.nodeId);
          if (!startNode) return null;
          const startDef = defMap.get(startNode.definitionId || startNode.type);

          const startPos = getSocketWorldCenter(
            startNode,
            activeDragWire.socketName,
            activeDragWire.isOutput,
            startDef,
          );

          const activeColor =
            SOCKET_COLORS[
              (activeDragWire.isOutput
                ? startDef?.outputs
                : startDef?.inputs
              )?.find((s) => s.name === activeDragWire.socketName)?.type ||
                'scalar'
            ];
          const endX = activeDragWire.curWorldX;
          const endY = activeDragWire.curWorldY;

          let pathData = '';

          if (activeDragWire.isOutput) {
            // Dragging from an OUTPUT socket (socket faces right, +X direction)
            const startX = startPos.x;
            const startY = startPos.y;
            const distX = endX - startX;

            if (distX >= 0) {
              // Forward arc: pure quadratic Bezier (control point extends horizontally from the socket)
              // Mathematically impossible to form an S-curve! Pure natural parabolic curvature into the cursor.
              const dx = Math.max(30, distX * 0.55);
              pathData = `M ${startX} ${startY} Q ${startX + dx} ${startY} ${endX} ${endY}`;
            } else {
              // Backward loop: cursor moved behind/left of the socket
              const loopDx = Math.max(
                35,
                Math.min(100, Math.abs(endY - startY) * 0.35 + 35),
              );
              pathData = `M ${startX} ${startY} C ${startX + loopDx} ${startY}, ${startX + loopDx} ${endY}, ${endX} ${endY}`;
            }
          } else {
            // Dragging from an INPUT socket (socket faces left, -X direction)
            const startX = startPos.x;
            const startY = startPos.y;
            const distX = startX - endX;

            if (distX >= 0) {
              // Forward arc: pure quadratic Bezier (control point extends horizontally to the left of the socket)
              // Mathematically impossible to form an S-curve! Pure natural parabolic curvature into the cursor.
              const dx = Math.max(30, distX * 0.55);
              pathData = `M ${startX} ${startY} Q ${startX - dx} ${startY} ${endX} ${endY}`;
            } else {
              // Backward loop: cursor moved behind/right of the socket
              const loopDx = Math.max(
                35,
                Math.min(100, Math.abs(endY - startY) * 0.35 + 35),
              );
              pathData = `M ${startX} ${startY} C ${startX - loopDx} ${startY}, ${startX - loopDx} ${endY}, ${endX} ${endY}`;
            }
          }

          return (
            <g>
              {/* Subtle glow behind the dragged line */}
              <path
                d={pathData}
                fill="none"
                stroke={activeColor}
                strokeWidth={haloStrokeWidth}
                strokeOpacity="0.2"
              />
              {/* Clean solid stroke wire, no middle dot */}
              <path
                d={pathData}
                fill="none"
                stroke={activeColor}
                strokeWidth={coreStrokeWidth}
                strokeLinecap="round"
              />
              {/* Endpoint cursor dot */}
              <circle
                cx={endX}
                cy={endY}
                r={coreStrokeWidth + 1.5}
                fill={activeColor}
                stroke="#141418"
                strokeWidth="1.5"
              />
            </g>
          );
        })()}
    </svg>
  );
};
