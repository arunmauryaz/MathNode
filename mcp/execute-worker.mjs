import { parentPort, workerData } from 'node:worker_threads';
try {
  const core = await import(workerData.coreUrl);
  const evaluated = core.executeMathGraph(
    workerData.nodes,
    workerData.connections,
    workerData.definitions,
  );
  const nodes = evaluated.updatedNodes.map((n) => ({
    ...n,
    display: Object.fromEntries(
      Object.entries(n.computedOutputs || {}).map(([name, value]) => [
        name,
        { text: core.formatValue(value, 12), latex: core.toLatex(value) },
      ]),
    ),
  }));
  parentPort.postMessage({
    ok: true,
    result: {
      nodes,
      errors: evaluated.errors,
      success: Object.values(evaluated.errors).every((e) => !e),
    },
  });
} catch (e) {
  parentPort.postMessage({ ok: false, error: e.message });
}
