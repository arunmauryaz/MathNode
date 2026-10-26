import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const run = promisify(execFile);
test('node SDK scaffolds, validates, and executes numeric and symbolic inputs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mathnode-sdk-test-')),
    path = join(directory, 'square.mnode'),
    cli = resolve('scripts/node-sdk.mjs');
  try {
    expect(
      (await run(process.execPath, [cli, 'scaffold', path])).stdout,
    ).toContain('Created');
    expect(
      (await run(process.execPath, [cli, 'validate', path])).stdout,
    ).toContain('Validated 1');
    expect(
      JSON.parse(
        (await run(process.execPath, [cli, 'run', path, '{"x":3}'])).stdout,
      ).result,
    ).toBe(10);
    expect(
      JSON.parse(
        (await run(process.execPath, [cli, 'run', path, '{"x":"A"}'])).stdout,
      ).result.latex,
    ).toContain('A');
    await expect(
      run(process.execPath, [cli, 'scaffold', path]),
    ).rejects.toThrow();
    await writeFile(
      path,
      JSON.stringify({
        id: 'broken',
        inputs: [],
        outputs: [{ name: 'x', type: 'unsupported' }],
        code: '()=>({x:1})',
      }),
    );
    await expect(
      run(process.execPath, [cli, 'validate', path]),
    ).rejects.toThrow('Invalid .mnode');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
