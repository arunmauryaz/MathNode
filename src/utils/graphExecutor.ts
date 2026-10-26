import { MathNodeInstance, NodeConnection, NodeDefinition } from '../types';
import { ExecutionResult } from './dagEngine';
export class GraphExecutor {
  private worker: Worker | null = null;
  private cancel: (() => void) | null = null;
  run(
    nodes: MathNodeInstance[],
    connections: NodeConnection[],
    definitions: NodeDefinition[],
  ): Promise<ExecutionResult> {
    this.cancel?.();
    if (!this.worker)
      this.worker = new Worker(new URL('./graph.worker.ts', import.meta.url), {
        type: 'module',
      });
    return new Promise((resolve, reject) => {
      const worker = this.worker!;
      const finish = () => {
        clearTimeout(timer);
        worker.onmessage = null;
        worker.onerror = null;
        this.cancel = null;
      };
      const timer = setTimeout(() => {
        finish();
        worker.terminate();
        this.worker = null;
        reject(
          new Error('Computation timed out (2 seconds). Check custom kernels.'),
        );
      }, 2000);
      this.cancel = () => {
        finish();
        worker.terminate();
        this.worker = null;
        reject(new Error('Cancelled'));
      };
      worker.onmessage = (event) => {
        finish();
        if (event.data.error) reject(new Error(event.data.error));
        else resolve(event.data.result);
      };
      worker.onerror = () => {
        finish();
        worker.terminate();
        this.worker = null;
        reject(new Error('Computation worker failed'));
      };
      worker.postMessage({ nodes, connections, definitions });
    });
  }
  dispose() {
    this.cancel?.();
    this.worker?.terminate();
    this.worker = null;
  }
}
