import React, { useMemo, useState } from 'react';
import { Boxes, X } from 'lucide-react';
import { GraphSnapshot, NodeDefinition } from '../../types';
import { createCompositeDefinition } from '../../utils/compositeNodes';
import { formatValue } from '../../utils/graphRules';
interface Props {
  mode: 'group' | 'node';
  graph: GraphSnapshot;
  ids: string[];
  definitions: NodeDefinition[];
  onClose: () => void;
  onCreate: (name: string, definition?: NodeDefinition) => void;
}
export function CreateSelectionModal({
  mode,
  graph,
  ids,
  definitions,
  onClose,
  onCreate,
}: Props) {
  const [name, setName] = useState(mode === 'node' ? 'My Node' : 'Node Group');
  const [labels, setLabels] = useState<Record<string, string>>({});
  const preview = useMemo(() => {
    if (mode === 'group') return { definition: undefined, error: '' };
    try {
      return {
        definition: createCompositeDefinition(
          graph,
          ids,
          definitions,
          'My Node',
        ),
        error: '',
      };
    } catch (error) {
      return {
        definition: undefined,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }, [mode, graph, ids, definitions]);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || preview.error) return;
    const definition = preview.definition
      ? structuredClone(preview.definition)
      : undefined;
    if (definition) {
      definition.name = name.trim();
      definition.inputs = definition.inputs.map((s) => ({
        ...s,
        label: labels[`in:${s.name}`]?.trim() || s.label || s.name,
      }));
      definition.outputs = definition.outputs.map((s) => ({
        ...s,
        label: labels[`out:${s.name}`]?.trim() || s.label || s.name,
      }));
    }
    onCreate(name.trim(), definition);
  };
  return (
    <div
      className="fixed inset-0 z-[70] bg-black/65 flex items-center justify-center p-5"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'node' ? 'Make Node' : 'Make Group'}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <form
        onSubmit={submit}
        className="mathnode-modal w-[540px] max-w-full max-h-[90vh] flex flex-col overflow-hidden"
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') onClose();
        }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#363640] bg-[#27272E]">
          <div className="flex gap-2 items-center text-sm font-semibold">
            <Boxes size={16} />
            {mode === 'node' ? 'Make Node' : 'Make Group'}
          </div>
          <button type="button" aria-label="Cancel creation" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-auto">
          <label className="block text-xs text-[#8E8E96]">
            Name
            <input
              autoFocus
              required
              maxLength={80}
              aria-label="Name"
              className="mt-1 w-full bg-[#141417] border border-[#363640] rounded px-3 py-2 text-[#EDEDED] outline-none focus:border-[#4B78D8]"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <p className="text-xs text-[#8E8E96]">
            {mode === 'node'
              ? `${ids.length} nodes become one reusable node in My Nodes. Internal wiring and settings are preserved.`
              : `${ids.length} nodes stay on the canvas inside a named group. Drag the group header to move them together.`}
          </p>
          {preview.error && (
            <p role="alert" className="text-xs text-red-300">
              {preview.error}
            </p>
          )}
          {preview.definition && (
            <>
              {(['in', 'out'] as const).map((direction) => (
                <div key={direction}>
                  <div className="text-[11px] font-semibold uppercase text-[#8E8E96] mb-2">
                    {direction === 'in' ? 'Input sockets' : 'Output sockets'}
                  </div>
                  <div className="space-y-2">
                    {(direction === 'in'
                      ? preview.definition!.inputs
                      : preview.definition!.outputs
                    ).map((socket) => (
                      <div
                        key={socket.name}
                        className="flex items-center gap-2"
                      >
                        <input
                          aria-label={`${direction === 'in' ? 'Input' : 'Output'} label ${socket.name}`}
                          className="flex-1 min-w-0 bg-[#141417] border border-[#363640] rounded px-2 py-1 text-xs"
                          value={
                            labels[`${direction}:${socket.name}`] ??
                            socket.label ??
                            socket.name
                          }
                          onChange={(e) =>
                            setLabels({
                              ...labels,
                              [`${direction}:${socket.name}`]: e.target.value,
                            })
                          }
                        />
                        <span className="text-[10px] text-[#8E8E96] font-mono">
                          {socket.type}
                          {direction === 'in' && socket.default !== undefined
                            ? ` = ${formatValue(socket.default)}`
                            : ''}
                        </span>
                      </div>
                    ))}
                    {direction === 'in' &&
                      !preview.definition!.inputs.length && (
                        <p className="text-xs text-[#686872]">
                          No external inputs. Internal constants are preserved.
                        </p>
                      )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
        <div className="px-5 py-3 border-t border-[#363640] flex justify-end gap-2">
          <button
            type="button"
            className="btn-plastic-secondary px-3 py-1 text-xs"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-plastic-primary px-3 py-1 text-xs disabled:opacity-40"
            disabled={!name.trim() || !!preview.error}
          >
            {mode === 'node' ? 'Create Node' : 'Create Group'}
          </button>
        </div>
      </form>
    </div>
  );
}
