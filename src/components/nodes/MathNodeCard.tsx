import { VectorField } from './VectorField';
import { FormulaView, ScalarField } from './FormulaView';

import { isSymbolic, isEquation, toLatex } from '../../utils/symbolicMath';

import React, { useEffect, useState } from 'react';

import {
  Trash2,
  Copy,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  AlertCircle,
  Boxes,
} from 'lucide-react';

import {
  MathNodeInstance,
  NodeDefinition,
  NodeConnection,
  NodeSocketDef,
} from '../../types';

import { MathIcon } from './MathIcon';

import {
  getNodeSocketYOffset,
  getNodeMinDimensions,
  inputRowHeight,
} from '../../utils/socketGeometry';

import { formatValue, SOCKET_COLORS } from '../../utils/graphRules';

interface MathNodeCardProps {
  node: MathNodeInstance;

  readOnly?: boolean;

  preview?: boolean;

  onInspect?: () => void;

  definition?: NodeDefinition;

  isSelected: boolean;

  connections: NodeConnection[];

  allNodes?: MathNodeInstance[];

  onUpdateValues: (id: string, values: Record<string, unknown>) => void;

  onUpdateTitle?: (id: string, title: string) => void;

  onToggleCollapse: (id: string) => void;

  onDeleteNode: (id: string) => void;

  onDuplicateNode?: (id: string) => void;

  onStartConnection: (
    id: string,

    socket: string,

    output: boolean,

    x: number,

    y: number,

    branch?: boolean,
  ) => void;

  onEndConnection: (id: string, socket: string, output: boolean) => void;

  onSocketMenu: (
    e: React.MouseEvent,

    id: string,

    socket: string,

    output: boolean,
  ) => void;

  onResizeStart?: (
    e: React.MouseEvent,

    id: string,

    handle: 'tl' | 'tr' | 'bl' | 'br',
  ) => void;

  onBeginEdit: () => void;

  onEndEdit: () => void;

  onNotice: (message: string) => void;

  precision: number;

  snapTarget?: { nodeId: string; socketName: string; isOutput: boolean } | null;

  compatibleSocket?: (id: string, name: string, output: boolean) => boolean;
}

const fieldClass =
  'h-[28px] min-w-0 w-full px-2 text-right rounded-[5px] bg-[#141417] border border-[#2C2C34] text-[11px] text-white font-mono focus:outline-none focus:border-[#4B78D8]';

export function NumberField({
  value,

  onChange,

  min,

  max,

  step,

  onBegin,

  onEnd,

  label,
}: {
  value: unknown;

  onChange: (v: number) => void;

  min?: number;

  max?: number;

  step?: number;

  onBegin: () => void;

  onEnd: () => void;

  label: string;
}) {
  const [draft, setDraft] = useState(String(value ?? 0));

  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(value ?? 0));
  }, [value, focused]);

  const clamp = (v: number) =>
    Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));

  return (
    <input
      aria-label={label}

      type="text"

      inputMode="decimal"

      className={fieldClass}

      value={draft}

      onFocus={() => {
        setFocused(true);

        onBegin();
      }}

      onChange={(e) => {
        onBegin();

        const text = e.target.value;

        setDraft(text);

        if (text.trim() && Number.isFinite(Number(text)))
          onChange(clamp(Number(text)));
      }}

      onBlur={() => {
        const n = Number(draft);

        if (draft.trim() && Number.isFinite(n)) onChange(clamp(n));

        setFocused(false);

        onEnd();
      }}

      onKeyDown={(e) => {
        e.stopPropagation();

        if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();

        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();

          const next = clamp(
            (Number(draft) || 0) + (e.key === 'ArrowUp' ? 1 : -1) * (step ?? 1),
          );

          setDraft(String(next));

          onChange(next);
        }
      }}
    />
  );
}

export const MathNodeCard: React.FC<MathNodeCardProps> = ({
  node,

  readOnly = false,

  preview = false,

  onInspect,

  definition,

  isSelected,

  connections,

  allNodes,

  onUpdateValues,

  onUpdateTitle,

  onToggleCollapse,

  onDeleteNode,

  onDuplicateNode,

  onStartConnection,

  onEndConnection,

  onSocketMenu,

  onResizeStart,

  onBeginEdit,

  onEndEdit,

  onNotice,

  precision,

  snapTarget,

  compatibleSocket,
}) => {
  const [editingTitle, setEditingTitle] = useState(false);

  const [titleDraft, setTitleDraft] = useState(node.title);

  const { minWidth, minHeight } = getNodeMinDimensions(node, definition);

  const width = Math.max(minWidth, node.width || 260);

  const inputs = definition?.inputs || [];

  const outputs = definition?.outputs || [];

  const change = (name: string, value: unknown) =>
    onUpdateValues(node.id, { ...node.values, [name]: value });

  const copy = async (value: unknown) => {
    try {
      await navigator.clipboard.writeText(
        isSymbolic(value) || isEquation(value)
          ? toLatex(value)
          : typeof value === 'object'
            ? JSON.stringify(value, null, 2)
            : String(value),
      );

      onNotice('Copied result');
    } catch {
      onNotice('Clipboard unavailable');
    }
  };

  const commitTitle = () => {
    if (!editingTitle) return;

    setEditingTitle(false);

    if (titleDraft.trim() && titleDraft.trim() !== node.title)
      onUpdateTitle?.(node.id, titleDraft.trim());
  };

  const number = (
    name: string,

    value: unknown,

    set: (v: number) => void,

    socket?: NodeSocketDef,
  ) => (
    <NumberField
      label={name}

      value={value}

      onChange={set}

      min={socket?.min}

      max={socket?.max}

      step={socket?.step}

      onBegin={onBeginEdit}

      onEnd={onEndEdit}
    />
  );

  const renderWidget = (s: NodeSocketDef) => {
    const value =
      node.values?.[s.name] ??
      s.default ??
      (s.type === 'bool' ? false : s.type === 'string' ? '' : 0);

    const conn = connections.find(
      (c) => c.toNodeId === node.id && c.toSocket === s.name,
    );

    if (conn) {
      const source = allNodes?.find((n) => n.id === conn.fromNodeId);

      return (
        <FormulaView
          value={
            source?.error
              ? 'Upstream error'
              : source?.computedOutputs?.[conn.fromSocket]
          }
          precision={precision}
          title={`From ${source?.title || 'Missing node'} · ${conn.fromSocket}`}
          className="text-[11px] text-[#8E8E96] overflow-auto max-h-full"
        />
      );
    }

    if (s.type === 'vector')
      return (
        <VectorField
          label={s.label || s.name}
          value={value}
          onChange={(v) => change(s.name, v)}
          onBegin={onBeginEdit}
          onEnd={onEndEdit}
        />
      );
    if (s.widget === 'dropdown')
      return (
        <select
          aria-label={s.label || s.name}

          className={fieldClass}

          value={String(value)}

          onFocus={onBeginEdit}

          onBlur={onEndEdit}

          onChange={(e) => {
            onBeginEdit();

            change(s.name, e.target.value);

            onEndEdit();
          }}
        >
          {s.options?.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      );

    if (s.widget === 'toggle' || s.type === 'bool')
      return (
        <input
          aria-label={s.label || s.name}

          type="checkbox"

          checked={Boolean(value)}

          onChange={(e) => {
            onBeginEdit();

            change(s.name, e.target.checked);

            onEndEdit();
          }}
        />
      );

    if (s.widget === 'matrix2x2' || s.widget === 'matrix4x4') {
      const size = s.widget === 'matrix4x4' ? 4 : 2;

      const matrix = Array.from({ length: size }, (_, r) =>
        Array.from({ length: size }, (_, c) =>
          Array.isArray(value) && Array.isArray(value[r])
            ? Number(value[r][c] ?? 0)
            : 0,
        ),
      );

      return (
        <div
          className="grid gap-1 w-full"

          style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        >
          {matrix.flatMap((row, r) =>
            row.map((v, c) => (
              <React.Fragment key={`${r}-${c}`}>
                {number(`${s.name} row ${r + 1} column ${c + 1}`, v, (next) =>
                  change(
                    s.name,

                    matrix.map((line, ri) =>
                      line.map((cell, ci) =>
                        ri === r && ci === c ? next : cell,
                      ),
                    ),
                  ),
                )}
              </React.Fragment>
            )),
          )}
        </div>
      );
    }

    if (s.widget === 'text' || s.type === 'string' || s.type === 'calculus')
      return (
        <input
          aria-label={s.label || s.name}

          className={fieldClass}

          value={String(value)}

          onFocus={onBeginEdit}

          onBlur={onEndEdit}

          onChange={(e) => change(s.name, e.target.value)}
        />
      );

    if (s.widget === 'slider')
      return (
        <input
          aria-label={s.label || s.name}

          type="range"

          min={s.min ?? 0}

          max={s.max ?? 100}

          step={s.step ?? 1}

          value={Number(value)}

          onFocus={onBeginEdit}

          onBlur={onEndEdit}

          onPointerDown={onBeginEdit}

          onPointerUp={onEndEdit}

          onChange={(e) => {
            onBeginEdit();

            change(s.name, Number(e.target.value));
          }}
        />
      );

    if (s.type === 'scalar')
      return (
        <ScalarField
          label={s.label || s.name}
          value={value}
          min={s.min}
          max={s.max}
          step={s.step}
          onChange={(v) => change(s.name, v)}
          onBegin={onBeginEdit}
          onEnd={onEndEdit}
        />
      );

    return number(s.label || s.name, value, (v) => change(s.name, v), {
      ...s,

      step: s.step ?? (s.type === 'int' ? 1 : undefined),
    });
  };

  return (
    <div
      id={preview ? undefined : `math-node-${node.id}`}

      data-node-id={preview ? undefined : node.id}

      data-node-selected={isSelected}

      data-node-error-kind={
        node.error ? node.errorKind || 'calculation' : undefined
      }

      data-node-preview-card={preview || undefined}

      className={`relative rounded-xl bg-[#222227] border select-none group/node flex flex-col ${node.error ? (node.errorKind === 'upstream' ? 'border-[#E0B05C] border-dashed' : 'border-[#EF4444]') : isSelected ? 'border-[#4B78D8]' : 'border-[#363640]'}`}

      style={{
        width,

        height: node.collapsed
          ? minHeight
          : Math.max(minHeight, node.height || minHeight),

        boxShadow: '0 2px 0 #141416, 0 8px 20px #0006',
      }}
    >
      <div
        className="flex items-center gap-2 px-3 h-[42px] border-b border-[#31313A] shrink-0 bg-[#27272E] rounded-t-xl"

        data-node-header
      >
        <button
          aria-label={node.collapsed ? 'Expand node' : 'Collapse node'}

          disabled={readOnly}

          onClick={() => onToggleCollapse(node.id)}

          className="text-[#8E8E96]"
        >
          {node.collapsed ? (
            <ChevronRight size={13} />
          ) : (
            <ChevronDown size={13} />
          )}
        </button>

        {definition?.composite ? (
          <button
            aria-label="Open node contents"

            title={`Created node: ${definition.composite.nodes.length} internal nodes. Open contents.`}

            className="text-[#8E8E96] hover:text-white"

            onClick={onInspect}
          >
            <Boxes size={14} />
          </button>
        ) : (
          <MathIcon name={definition?.icon || 'function'} size={14} />
        )}

        {editingTitle ? (
          <input
            aria-label="Node title"

            autoFocus

            value={titleDraft}

            onChange={(e) => setTitleDraft(e.target.value)}

            onBlur={commitTitle}

            onKeyDown={(e) => {
              e.stopPropagation();

              if (e.key === 'Enter') commitTitle();

              if (e.key === 'Escape') {
                setEditingTitle(false);

                setTitleDraft(node.title);
              }
            }}

            className="min-w-0 w-full bg-[#141417] text-[12px] outline-none"
          />
        ) : (
          <span
            className="text-[12px] font-semibold truncate flex-1"

            title="Double-click to rename"

            onDoubleClick={(e) => {
              e.stopPropagation();

              if (readOnly) return;

              setTitleDraft(node.title);

              setEditingTitle(true);
            }}
          >
            {node.title}
          </span>
        )}

        {isSelected && !readOnly && (
          <>
            <button
              title="Duplicate node"

              onClick={() => onDuplicateNode?.(node.id)}
            >
              <Copy size={12} />
            </button>

            <button title="Delete node" onClick={() => onDeleteNode(node.id)}>
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>

      {!node.collapsed && (
        <fieldset
          disabled={readOnly}

          className="p-[14px] flex flex-col gap-[10px] min-h-0 min-w-0 text-[11px]"
        >
          {(node.definitionId || node.type) === 'math.value' &&
            (readOnly ? (
              <div className="h-[74px] flex items-center justify-between gap-3">
                <span>Input value</span>

                <pre className="font-mono text-[#34D399] overflow-auto">
                  {formatValue(node.computedOutputs?.value, precision)}
                </pre>
              </div>
            ) : (
              <div className="space-y-[10px] h-[74px]">
                <div className="h-8 flex items-center justify-between gap-3">
                  <span>Value</span>

                  <div className="flex-1 min-w-0 max-w-[80%]">
                    <ScalarField
                      label="Value"
                      value={node.values?.value ?? 10}
                      onChange={(v) => change('value', v)}
                      onBegin={onBeginEdit}
                      onEnd={onEndEdit}
                    />
                  </div>
                </div>

                {typeof (node.values?.value ?? 10) === 'number' ? (
                  <input
                    aria-label="Value slider"

                    className="w-full accent-blue-500"

                    type="range"

                    min={-100}

                    max={100}

                    step={0.1}

                    value={Number(node.values?.value ?? 10)}

                    onFocus={onBeginEdit}

                    onBlur={onEndEdit}

                    onPointerDown={onBeginEdit}

                    onPointerUp={onEndEdit}

                    onChange={(e) => {
                      onBeginEdit();

                      change('value', Number(e.target.value));
                    }}
                  />
                ) : /^[\p{L}_][\p{L}\p{N}_]*$/u.test(
                    String(node.values?.value),
                  ) ? (
                  <div className="flex items-center gap-2 h-7">
                    <label className="flex items-center gap-1 shrink-0 text-[#8E8E96]">
                      <input
                        aria-label="Assign numerical value"
                        type="checkbox"
                        checked={!!node.values?.assigned}
                        onChange={(e) => change('assigned', e.target.checked)}
                      />
                      Use value
                    </label>
                    {!!node.values?.assigned &&
                      number('Assigned value', node.values?.binding ?? 0, (v) =>
                        change('binding', v),
                      )}
                  </div>
                ) : (
                  <span className="block text-[#8E8E96] text-[10px]">
                    LaTeX formula · use Substitute to bind symbols
                  </span>
                )}
              </div>
            ))}

          {inputs.map((s) => (
            <div
              key={s.name}

              className="flex items-center justify-between gap-3 shrink-0"

              style={{ height: inputRowHeight(s.widget, s.type) }}
            >
              <span
                title={`${s.type} · ${s.description || s.name}`}

                className="text-[#8E8E96] max-w-[30%] truncate"
              >
                {s.label || s.name}
              </span>

              <div className="flex-1 min-w-0 max-w-[75%]">
                <fieldset
                  disabled={!!s.enabledWhen && !node.values?.[s.enabledWhen]}

                  className={
                    s.enabledWhen && !node.values?.[s.enabledWhen]
                      ? 'opacity-40'
                      : ''
                  }
                >
                  {renderWidget(s)}
                </fieldset>
              </div>
            </div>
          ))}

          {outputs.map((s) => (
            <div
              key={s.name}

              className="h-[52px] shrink-0 flex items-center justify-between gap-2"
            >
              <span className="text-[#8E8E96]">{s.label || s.name}</span>

              <FormulaView
                value={node.error ? undefined : node.computedOutputs?.[s.name]}
                precision={precision}
                className="max-w-[75%] max-h-full overflow-auto text-[#34D399] text-[12px]"
              />
            </div>
          ))}

          {(node.definitionId || node.type) === 'math.output' && (
            <div className="h-20 p-3 rounded-lg bg-[#141417] border border-[#2B2B32] flex items-center justify-between gap-2">
              <FormulaView
                value={node.error ? undefined : node.computedOutputs?.output}
                precision={precision}
                className="text-[#34D399] text-[16px] overflow-auto max-h-full"
              />

              <button
                title={
                  isSymbolic(node.computedOutputs?.output) ||
                  isEquation(node.computedOutputs?.output)
                    ? 'Copy LaTeX'
                    : 'Copy full result'
                }

                onClick={() => copy(node.computedOutputs?.output)}
              >
                <ClipboardCopy size={13} />
              </button>
            </div>
          )}
        </fieldset>
      )}

      {(node.error || !definition) && (
        <div
          title={
            node.error ||
            `Install definition: ${node.definitionId || node.type}`
          }

          className={`absolute bottom-0 left-0 right-0 rounded-b-xl px-2 py-1 text-[10px] flex gap-1 ${node.errorKind === 'upstream' ? 'bg-[#2B2416] text-[#E0B05C]' : 'bg-[#2B1316] text-[#FCA5A5]'}`}
        >
          <AlertCircle size={12} />

          <span className="truncate">
            {node.error || 'Missing node definition'}
          </span>
        </div>
      )}

      {[false, true].flatMap((output) =>
        (output ? outputs : inputs)

          .filter((s) => s.connectable !== false)

          .map((s) => {
            const target =
              snapTarget?.nodeId === node.id &&
              snapTarget.socketName === s.name &&
              snapTarget.isOutput === output;

            const compatible = compatibleSocket?.(node.id, s.name, output);

            return (
              <div
                key={`${output}-${s.name}`}

                data-socket-name={s.name}

                data-socket-output={String(output)}

                title={`${s.name} (${s.type}) · drag to connect or move wire · Shift-drag output to branch · right-click for actions`}

                onMouseDown={(e) => {
                  if (e.button !== 0) return;

                  e.stopPropagation();

                  e.preventDefault();

                  onStartConnection(
                    node.id,

                    s.name,

                    output,

                    e.clientX,

                    e.clientY,

                    e.shiftKey,
                  );
                }}

                onMouseUp={(e) => {
                  if (e.button !== 0) return;

                  e.stopPropagation();

                  onEndConnection(node.id, s.name, output);
                }}

                onContextMenu={(e) => {
                  e.preventDefault();

                  e.stopPropagation();

                  onSocketMenu(e, node.id, s.name, output);
                }}

                className="absolute w-3 h-3 rounded-full border-2 border-[#161616] cursor-crosshair z-20"

                style={{
                  top: getNodeSocketYOffset(node, s.name, output, definition),

                  transform: 'translateY(-50%)',

                  left: output ? undefined : -6,

                  right: output ? -6 : undefined,

                  background: SOCKET_COLORS[s.type],

                  opacity: compatible === false ? 0.35 : 1,

                  boxShadow: target
                    ? '0 0 0 4px #4B78D8'
                    : compatible
                      ? '0 0 0 2px #363640'
                      : undefined,
                }}
              >
                <div className="absolute -inset-2 rounded-full" />
              </div>
            );
          }),
      )}

      {!node.collapsed &&
        !readOnly &&
        !preview &&
        (['tl', 'tr', 'bl', 'br'] as const).map((handle) => (
          <div
            key={handle}

            title="Resize node"

            onMouseDown={(e) => {
              if (e.button === 0) onResizeStart?.(e, node.id, handle);
            }}

            className={`absolute w-4 h-4 text-[#8E8E96] hover:text-[#EDEDED] hover:!opacity-100 z-10 ${isSelected ? 'opacity-60' : 'opacity-0 group-hover/node:opacity-70'}`}

            style={{
              top: handle[0] === 't' ? 2 : undefined,

              bottom: handle[0] === 'b' ? 2 : undefined,

              left: handle[1] === 'l' ? 2 : undefined,

              right: handle[1] === 'r' ? 2 : undefined,

              cursor:
                handle === 'tl' || handle === 'br'
                  ? 'nwse-resize'
                  : 'nesw-resize',
            }}
          >
            <svg
              aria-hidden="true"

              viewBox="0 0 16 16"

              className="w-full h-full pointer-events-none"

              fill="none"

              stroke="currentColor"

              strokeWidth="1.3"

              strokeLinecap="round"

              style={{
                transform: `scale(${handle[1] === 'l' ? -1 : 1}, ${handle[0] === 't' ? -1 : 1})`,
              }}
            >
              <path d="M 4 12 L 12 4 M 8 12 L 12 8" />
            </svg>
          </div>
        ))}
    </div>
  );
};
