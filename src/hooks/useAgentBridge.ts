import { useEffect, useRef, useState } from 'react';
import { MathGraph, MathNodeFolder, NodeDefinition } from '../types';
export interface AgentSnapshot {
  graph: MathGraph;
  definitions: NodeDefinition[];
  folders: MathNodeFolder[];
}
export function useAgentBridge(
  enabled: boolean,
  port: number,
  getSnapshot: () => AgentSnapshot | null,
  apply: (snapshot: AgentSnapshot) => AgentSnapshot,
) {
  const callbacks = useRef({ getSnapshot, apply });
  callbacks.current = { getSnapshot, apply };
  const [status, setStatus] = useState('Disconnected');
  useEffect(() => {
    if (!enabled) {
      setStatus('Disconnected');
      return;
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setStatus('Invalid MCP port');
      return;
    }
    let clientId: string;
    try {
      clientId =
        sessionStorage.getItem('mn_mcp_client_id') || crypto.randomUUID();
      sessionStorage.setItem('mn_mcp_client_id', clientId);
    } catch {
      clientId = crypto.randomUUID();
    }
    let stopped = false,
      token = '',
      ackId: string | undefined,
      ackHash: string | undefined,
      ackRevision: number | undefined,
      applyError: string | undefined,
      timer: ReturnType<typeof setTimeout>;
    const abort = new AbortController(),
      base = `http://127.0.0.1:${port}`;
    const poll = async () => {
      try {
        if (!token) {
          const response = await fetch(base + '/bridge/session', {
            signal: abort.signal,
          });
          if (!response.ok) throw Error('MCP bridge unavailable');
          token = (await response.json()).token;
        }
        const snapshot = callbacks.current.getSnapshot();
        if (!snapshot) {
          setStatus('Open a graph to connect');
          return;
        }
        const sent = JSON.stringify(snapshot);
        const reportedError = applyError;
        applyError = undefined;
        const response = await fetch(base + '/bridge/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-MathNode-Token': token,
          },
          body: JSON.stringify({
            clientId,
            snapshot,
            ackId,
            ackHash,
            ackRevision,
            applyError: reportedError,
          }),
          signal: abort.signal,
        });
        if (!response.ok) {
          token = '';
          throw Error(
            response.status === 409
              ? 'Another browser is connected'
              : 'MCP connection failed',
          );
        }
        const result = await response.json();
        if (stopped) return;
        if (result.pending) {
          if (JSON.stringify(callbacks.current.getSnapshot()) !== sent) {
            applyError = 'Canvas changed while receiving an agent update';
            setStatus(applyError);
            return;
          }
          try {
            const applied = callbacks.current.apply(result.pending.snapshot);
            const digest = await crypto.subtle.digest(
              'SHA-256',
              new TextEncoder().encode(JSON.stringify(applied)),
            );
            ackHash = Array.from(new Uint8Array(digest), (b) =>
              b.toString(16).padStart(2, '0'),
            ).join('');
            ackRevision = result.pending.revision;
            ackId = result.pending.commandId;
            applyError = undefined;
            setStatus('Connected · agent update applied');
          } catch (e) {
            applyError = e instanceof Error ? e.message : 'Invalid agent graph';
            setStatus(applyError);
          }
        } else setStatus(result.error || 'Connected');
      } catch (e) {
        if (!stopped)
          setStatus(
            e instanceof Error && e.message !== 'Failed to fetch'
              ? e.message
              : 'Waiting for MCP server',
          );
      } finally {
        if (!stopped) timer = setTimeout(poll, 1000);
      }
    };
    setStatus('Connecting');
    void poll();
    return () => {
      stopped = true;
      abort.abort();
      clearTimeout(timer);
    };
  }, [enabled, port]);
  return status;
}
