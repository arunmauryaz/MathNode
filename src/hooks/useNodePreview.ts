import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { NodeDefinition } from '../types';
export interface PreviewTarget {
  definition: NodeDefinition;
  anchor: HTMLElement;
}
export function useNodePreview(enabled = true) {
  const id = `node-preview-${useId()}`;
  const [target, setTarget] = useState<PreviewTarget | null>(null);
  const current = useRef<PreviewTarget | null>(null);
  const opening = useRef<ReturnType<typeof setTimeout>>();
  const closing = useRef<ReturnType<typeof setTimeout>>();
  const cancelClose = useCallback(() => {
    clearTimeout(closing.current);
  }, []);
  const hide = useCallback(() => {
    clearTimeout(opening.current);
    clearTimeout(closing.current);
    current.current = null;
    setTarget(null);
  }, []);
  const show = useCallback(
    (definition: NodeDefinition, anchor: HTMLElement, immediately = false) => {
      if (!enabled) return;
      clearTimeout(opening.current);
      clearTimeout(closing.current);
      const reveal = () => {
        if (!anchor.isConnected) return;
        const next = { definition, anchor };
        current.current = next;
        setTarget(next);
      };
      if (immediately || current.current) reveal();
      else opening.current = setTimeout(reveal, 180);
    },
    [enabled],
  );
  const hideSoon = useCallback(() => {
    clearTimeout(opening.current);
    clearTimeout(closing.current);
    closing.current = setTimeout(hide, 140);
  }, [hide]);
  useEffect(() => {
    if (!enabled) hide();
  }, [enabled, hide]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    const outside = (event: PointerEvent) => {
      if (!(event.target as Element).closest?.('[data-node-preview]')) hide();
    };
    window.addEventListener('keydown', escape);
    window.addEventListener('pointerdown', outside);
    window.addEventListener('dragstart', hide);
    return () => {
      clearTimeout(opening.current);
      clearTimeout(closing.current);
      window.removeEventListener('keydown', escape);
      window.removeEventListener('pointerdown', outside);
      window.removeEventListener('dragstart', hide);
    };
  }, [hide]);
  return {
    id,
    target: enabled ? target : null,
    show,
    hide,
    hideSoon,
    cancelClose,
  };
}
