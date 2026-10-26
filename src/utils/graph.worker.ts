import { executeMathGraph } from './dagEngine';
// Kernels run off the UI thread. Block common I/O APIs; this is not a security boundary for hostile code.
for (const name of [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'importScripts',
  'Worker',
  'SharedWorker',
  'indexedDB',
  'caches',
]) {
  try {
    Object.defineProperty(globalThis, name, {
      value: undefined,
      writable: false,
      configurable: false,
    });
  } catch {
    /* unavailable API */
  }
}
self.onmessage = (event) => {
  const { nodes, connections, definitions } = event.data;
  try {
    self.postMessage({
      result: executeMathGraph(nodes, connections, definitions),
    });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
