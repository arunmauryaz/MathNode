import { test, expect, Page } from '@playwright/test';
const cards = (page: Page) => page.locator('[data-node-id]');
async function add(page: Page, name: string) {
  await page.keyboard.press('Tab');
  await page.getByRole('combobox', { name: 'Search nodes' }).fill(name);
  await page.getByRole('option').filter({ hasText: name }).first().click();
  await expect(page.getByRole('dialog', { name: 'Add node' })).toHaveCount(0);
  return cards(page).last();
}
async function saved(page: Page) {
  await page.waitForTimeout(650);
  return page.evaluate(() => {
    const tabs = JSON.parse(localStorage.getItem('mn_saved_tabs') || '[]');
    return tabs.find(
      (t: { id: string }) => t.id === localStorage.getItem('mn_active_tab_id'),
    );
  });
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('mn_user_settings')) {
      localStorage.setItem('mn_show_startup', 'false');
      localStorage.setItem(
        'mn_user_settings',
        JSON.stringify({
          autoSave: true,
          showStartupModal: false,
          showMinimap: false,
          snapToGrid: true,
          gridDotSpacing: 24,
          precision: 6,
        }),
      );
    }
  });
  await page.goto('/');
  await expect(cards(page)).toHaveCount(4);
});
test('picker clicks, keyboard search, creation undo/redo and numeric editing work', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.mouse.dblclick(1100, 200);
  await page.getByRole('combobox', { name: 'Search nodes' }).fill('constant');
  await page.getByRole('option').filter({ hasText: 'Constant' }).click();
  await expect(cards(page)).toHaveCount(5);
  const constant = cards(page).last();
  await constant
    .getByLabel('constant', { exact: true })
    .selectOption('φ (Golden ratio)');
  await constant.getByLabel('constant', { exact: true }).blur();
  await expect(constant.locator('pre')).toContainText('1.61803');
  await page.keyboard.press('Control+z');
  await expect(constant.locator('pre')).toContainText('3.14159');
  await page.keyboard.press('Control+z');
  await expect(cards(page)).toHaveCount(4);
  await page.keyboard.press('Control+y');
  await expect(cards(page)).toHaveCount(5);
  await page.keyboard.press('Control+n');
  await expect(cards(page)).toHaveCount(0);
  const value = await add(page, 'Value');
  const field = value.getByLabel('Value', { exact: true });
  await field.fill('-');
  await expect(field).toHaveValue('-');
  await field.fill('-12.5');
  await field.blur();
  await expect(value.locator('pre')).toContainText('-12.5');
  await page.keyboard.press('Control+z');
  await expect(value.locator('pre')).toContainText('10');
  await page.keyboard.press('Control+y');
  await expect(value.locator('pre')).toContainText('-12.5');
  expect(errors).toEqual([]);
});
test('matrix widgets edit cells, render results and survive export/import', async ({
  page,
}) => {
  await page.keyboard.press('Control+n');
  const matrix = await add(page, 'Matrix Multiply');
  await expect(matrix.getByRole('textbox')).toHaveCount(8);
  await matrix.getByLabel('A row 1 column 1').fill('5');
  await matrix.getByLabel('A row 1 column 1').blur();
  await expect(matrix.locator('pre')).toContainText('[12, 4]');
  const before = await saved(page);
  expect(before.nodes[0].values.A[0][0]).toBe(5);
  await matrix.getByRole('button', { name: 'Collapse node' }).click();
  const collapsed = await saved(page);
  expect(collapsed.nodes[0].collapsed).toBe(true);
  await page.reload();
  await expect(cards(page)).toHaveCount(1);
  await expect(
    cards(page).getByRole('button', { name: 'Expand node' }),
  ).toBeVisible();
});
test('context menus are relevant, selection toggles once and movement history restores original coordinates', async ({
  page,
}) => {
  await page.mouse.click(1100, 220, { button: 'right' });
  await expect(
    page.getByRole('menuitem', { name: 'Add Node…', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Copy Canvas Coords')).toHaveCount(0);
  await page.keyboard.press('Escape');
  const first = cards(page).first(),
    second = cards(page).nth(1);
  await first.locator('[data-node-header]').click();
  await second.locator('[data-node-header]').click({ modifiers: ['Shift'] });
  await expect(
    page.locator('[data-node-id][data-node-selected="true"]'),
  ).toHaveCount(2);
  const before = await saved(page);
  const firstBefore = before.nodes[0];
  const secondBefore = before.nodes[1];
  await page.keyboard.press('ArrowRight');
  const moved = await saved(page);
  expect(moved.nodes[0].x - firstBefore.x).toBe(24);
  expect(moved.nodes[1].x - secondBefore.x).toBe(24);
  await page.keyboard.press('Control+z');
  const undone = await saved(page);
  expect(undone.nodes[0].x).toBe(firstBefore.x);
  expect(undone.nodes[1].x).toBe(secondBefore.x);
  await first.locator('[data-node-header]').click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: 'Align Left' })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('menuitem', { name: 'Frame Selection' }),
  ).toBeEnabled();
});
async function addAt(page: Page, name: string, x: number, y: number) {
  await page.mouse.dblclick(x, y);
  await page.getByRole('combobox', { name: 'Search nodes' }).fill(name);
  await page.getByRole('option').filter({ hasText: name }).first().click();
  return cards(page).last();
}
async function socketPoint(
  card: ReturnType<typeof cards>,
  name: string,
  output: boolean,
) {
  const box = await card
    .locator(`[data-socket-name="${name}"][data-socket-output="${output}"]`)
    .boundingBox();
  if (!box) throw new Error('Socket not visible');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function dragSocket(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}
test('drag connections compute, reconnect can be cancelled, wire menu disconnect and undo restore values', async ({
  page,
}) => {
  await page.keyboard.press('Control+n');
  await addAt(page, 'Value', 200, 220);
  const source = cards(page).nth(0);
  await addAt(page, 'Math Operation', 600, 220);
  const operation = cards(page).nth(1);
  await operation.getByLabel('b', { exact: true }).fill('5');
  await operation.getByLabel('b', { exact: true }).blur();
  await addAt(page, 'View Result', 1030, 220);
  const output = cards(page).nth(2);
  const sourceBeforeConnect = (await saved(page)).nodes[0];
  await dragSocket(
    page,
    await socketPoint(source, 'value', true),
    await socketPoint(operation, 'a', false),
  );
  const sourceAfterConnect = (await saved(page)).nodes[0];
  expect([sourceAfterConnect.x, sourceAfterConnect.y]).toEqual([
    sourceBeforeConnect.x,
    sourceBeforeConnect.y,
  ]);
  await expect(operation.locator('pre').last()).toContainText('15');
  await dragSocket(
    page,
    await socketPoint(operation, 'result', true),
    await socketPoint(output, 'input', false),
  );
  await expect(output.locator('pre').last()).toContainText('15');
  const beforeCancel = (await saved(page)).nodes.map(
    (n: { id: string; x: number; y: number }) => [n.id, n.x, n.y],
  );
  const input = await socketPoint(operation, 'a', false);
  await page.mouse.move(input.x, input.y);
  await page.mouse.down();
  await page.mouse.move(600, 750, { steps: 8 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  const afterCancel = await saved(page);
  expect(afterCancel.connections).toHaveLength(2);
  expect(
    afterCancel.nodes.map((n: { id: string; x: number; y: number }) => [
      n.id,
      n.x,
      n.y,
    ]),
  ).toEqual(beforeCancel);
  // Use socket actions as well: right-clicking a socket must never open the canvas menu.
  const point = await socketPoint(operation, 'a', false);
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await expect(
    page.getByRole('menuitem', { name: 'Disconnect', exact: true }),
  ).toBeEnabled();
  await page.getByRole('menuitem', { name: 'Disconnect', exact: true }).click();
  await expect(output.locator('pre').last()).toContainText('5');
  await page.keyboard.press('Control+z');
  await expect(output.locator('pre').last()).toContainText('15');
  await page.screenshot({ path: 'test-results/connected-workspace.png' });
});
test('dropping a wire into empty space creates and connects a compatible node in one undo step', async ({
  page,
}) => {
  await page.keyboard.press('Control+n');
  await addAt(page, 'Value', 200, 220);
  const point = await socketPoint(cards(page).first(), 'value', true);
  await dragSocket(page, point, { x: 700, y: 350 });
  await expect(page.getByRole('dialog', { name: 'Add node' })).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Search nodes' })
    .fill('View Result');
  await page.keyboard.press('Enter');
  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).last().locator('pre').last()).toContainText('10');
  await page.keyboard.press('Control+z');
  await expect(cards(page)).toHaveCount(1);
  expect((await saved(page)).connections).toHaveLength(0);
});
test('wire insertion preserves both sides and is undoable', async ({
  page,
}) => {
  const group = page.locator('[data-wire-id]').last();
  const path = group.locator('path').first();
  const point = await path.evaluate((el) => {
    const p = (el as SVGPathElement).getPointAtLength(
      (el as SVGPathElement).getTotalLength() / 2,
    );
    const m = (el as SVGPathElement).getScreenCTM()!;
    return { x: p.x * m.a + m.e, y: p.y * m.d + m.f };
  });
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert Node…' }).click();
  await page
    .getByRole('combobox', { name: 'Search nodes' })
    .fill('Math Function');
  await page.keyboard.press('Enter');
  await expect(cards(page)).toHaveCount(5);
  const graph = await saved(page);
  expect(graph.connections).toHaveLength(4);
  await expect(cards(page).nth(3).locator('pre').last()).toContainText(
    '-0.916522',
  );
  await page.keyboard.press('Control+z');
  await expect(cards(page)).toHaveCount(4);
  expect((await saved(page)).connections).toHaveLength(3);
});
test('workspace import/export restores actual nodes, connections and frames', async ({
  page,
}) => {
  const downloadPromise = page.waitForEvent('download');
  await page.locator('.doc-tab').first().click({ button: 'right' });
  await page.getByText('Export (.mathnode)', { exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.locator('input[type="file"]').first().setInputFiles(path!);
  await expect(cards(page)).toHaveCount(4);
  expect((await saved(page)).connections).toHaveLength(3);
  await expect(cards(page).nth(3).locator('pre').last()).toContainText('42');
});
test('auto-save off preserves saved session until explicit save; modal shortcuts cannot delete graph', async ({
  page,
}) => {
  const before = await saved(page);
  await page.getByRole('button', { name: 'Settings & Preferences' }).click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await expect(cards(page)).toHaveCount(4);
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await page
    .getByText('Auto-Save to Local Storage', { exact: true })
    .locator('../..')
    .locator('.plastic-toggle')
    .click();
  await page.getByRole('button', { name: 'Apply Changes' }).click();
  await addAt(page, 'Value', 1100, 100);
  await page.waitForTimeout(700);
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('mn_saved_tabs') || '[]'),
  );
  expect(
    stored.find((t: { id: string }) => t.id === before.id).nodes,
  ).toHaveLength(4);
  await page.keyboard.press('Control+s');
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('mn_saved_tabs') || '[]'),
  );
  expect(
    after.find((t: { id: string }) => t.id === before.id).nodes,
  ).toHaveLength(5);
});
test('nonterminating custom kernels time out while canvas remains responsive, then recover', async ({
  page,
}) => {
  await page.evaluate(() => {
    const defs = JSON.parse(localStorage.getItem('mn_nodes') || '[]');
    defs.push({
      id: 'test.loop',
      name: 'Loop Test',
      inputs: [],
      outputs: [{ name: 'result', type: 'scalar' }],
      code: '(inputs) => { while(true) {} }',
    });
    localStorage.setItem('mn_nodes', JSON.stringify(defs));
  });
  await page.reload();
  await page.keyboard.press('Control+n');
  await addAt(page, 'Loop Test', 300, 250);
  await expect(cards(page).first()).toContainText('timed out', {
    timeout: 10000,
  });
  await page.keyboard.press('Delete');
  await expect(cards(page)).toHaveCount(0);
  const value = await addAt(page, 'Value', 300, 250);
  await expect(value.locator('pre')).toContainText('10');
});

test('group dragging preserves spacing, undo restores positions, resizing anchors the opposite corner', async ({
  page,
}) => {
  await cards(page).first().locator('[data-node-header]').click();
  await cards(page)
    .nth(1)
    .locator('[data-node-header]')
    .click({ modifiers: ['Shift'] });
  const before = await saved(page);
  const header = await cards(page)
    .first()
    .locator('[data-node-header]')
    .boundingBox();
  await page.mouse.move(header!.x + 100, header!.y + 20);
  await page.mouse.down();
  await page.mouse.move(header!.x + 173, header!.y + 57, { steps: 8 });
  await page.mouse.up();
  const after = await saved(page);
  expect(after.nodes[1].x - after.nodes[0].x).toBe(
    before.nodes[1].x - before.nodes[0].x,
  );
  expect(after.nodes[1].y - after.nodes[0].y).toBe(
    before.nodes[1].y - before.nodes[0].y,
  );
  expect(after.nodes[0].x).not.toBe(before.nodes[0].x);
  await page.keyboard.press('Control+z');
  const restored = await saved(page);
  expect(restored.nodes[0].x).toBe(before.nodes[0].x);
  expect(restored.nodes[0].y).toBe(before.nodes[0].y);
  const handle = cards(page).first().getByTitle('Resize node').first();
  const box = await handle.boundingBox();
  const originalBox = await cards(page).first().boundingBox();
  await page.mouse.move(box!.x + 4, box!.y + 4);
  await page.mouse.down();
  await page.mouse.move(box!.x - 50, box!.y - 40, { steps: 5 });
  await page.mouse.up();
  const resizedBox = await cards(page).first().boundingBox();
  expect(resizedBox!.x + resizedBox!.width).toBeCloseTo(
    originalBox!.x + originalBox!.width,
    0,
  );
  expect(resizedBox!.y + resizedBox!.height).toBeCloseTo(
    originalBox!.y + originalBox!.height,
    0,
  );
  expect(resizedBox!.width).toBeGreaterThan(originalBox!.width);
  await page.keyboard.press('Control+z');
  const undoBox = await cards(page).first().boundingBox();
  expect(undoBox!.width).toBe(originalBox!.width);
});
test('clipboard preserves internal wires across tabs and storage failures are visible', async ({
  page,
}) => {
  await page.mouse.click(1200, 800);
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+n');
  await page.keyboard.press('Control+v');
  await expect(cards(page)).toHaveCount(4);
  expect((await saved(page)).connections).toHaveLength(3);
  await expect(cards(page).nth(3).locator('pre').last()).toContainText('42');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'mn_saved_tabs')
        throw new DOMException('Full', 'QuotaExceededError');
      original.call(this, key, value);
    };
  });
  await page.keyboard.press('Control+d');
  await expect(page.getByText('Save failed', { exact: false })).toBeVisible();
});
async function wireMidpoint(page: Page, index = 0) {
  return page
    .locator('[data-wire-id]')
    .nth(index)
    .locator('path')
    .first()
    .evaluate((el) => {
      const path = el as SVGPathElement;
      const p = path.getPointAtLength(path.getTotalLength() / 2),
        m = path.getScreenCTM()!;
      return { x: p.x * m.a + m.e, y: p.y * m.d + m.f };
    });
}
test('wires select with a visible boundary; Delete and Copy act on the connection, not its value', async ({
  page,
}) => {
  const point = await wireMidpoint(page);
  await page.mouse.click(point.x, point.y);
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.locator('[data-wire-selected="true"]')).toHaveCount(1);
  await expect(page.locator('[data-wire-outline]')).toHaveCount(1);
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await expect(
    page.getByRole('menuitem', { name: 'Copy', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('menuitem', { name: 'Copy Value', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('menuitem', { name: 'Copy', exact: true }).click();
  await page.keyboard.press('Delete');
  expect((await saved(page)).connections).toHaveLength(2);
  await page.keyboard.press('Control+v');
  expect((await saved(page)).connections).toHaveLength(3);
  await expect(cards(page)).toHaveCount(4);
  await expect(page.locator('[data-wire-selected="true"]')).toHaveCount(1);
  await page.keyboard.press('Delete');
  await page.keyboard.press('Control+z');
  expect((await saved(page)).connections).toHaveLength(3);
});
test('connected endpoints move a single wire, empty drops disconnect, Escape cancels and Shift creates branches', async ({
  page,
}) => {
  const original = await saved(page),
    old = original.connections[0];
  const input = await socketPoint(cards(page).nth(2), 'a', false),
    otherInput = await socketPoint(cards(page).nth(2), 'b', false);
  await page.mouse.move(input.x, input.y);
  await page.mouse.down();
  await page.mouse.move(otherInput.x, otherInput.y, { steps: 8 });
  await expect(page.locator(`[data-wire-id="${old.id}"]`)).toHaveCount(0);
  await expect(page.locator('[data-wire-id]')).toHaveCount(2);
  await page.mouse.up();
  const moved = await saved(page);
  expect(moved.connections).toHaveLength(2);
  expect(
    moved.connections.find((c: { id: string }) => c.id === old.id).toSocket,
  ).toBe('b');
  await page.keyboard.press('Control+z');
  expect((await saved(page)).connections).toHaveLength(3);
  const source = await socketPoint(cards(page).first(), 'value', true),
    otherSource = await socketPoint(cards(page).nth(1), 'value', true);
  await dragSocket(page, source, otherSource);
  const sourceMoved = await saved(page);
  expect(sourceMoved.connections).toHaveLength(3);
  expect(
    sourceMoved.connections.find((c: { id: string }) => c.id === old.id)
      .fromNodeId,
  ).toBe(original.nodes[1].id);
  await page.keyboard.press('Control+z');
  await dragSocket(page, await socketPoint(cards(page).nth(2), 'a', false), {
    x: 1200,
    y: 800,
  });
  expect((await saved(page)).connections).toHaveLength(2);
  await page.keyboard.press('Control+z');
  expect((await saved(page)).connections).toHaveLength(3);
  const start = await socketPoint(cards(page).nth(2), 'a', false);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(1200, 800, { steps: 8 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect((await saved(page)).connections).toHaveLength(3);
  await page.keyboard.down('Shift');
  await dragSocket(
    page,
    await socketPoint(cards(page).first(), 'value', true),
    await socketPoint(cards(page).nth(3), 'input', false),
  );
  await page.keyboard.up('Shift');
  const branched = await saved(page);
  expect(branched.connections).toHaveLength(3);
  expect(
    branched.connections.filter(
      (c: { fromNodeId: string }) => c.fromNodeId === original.nodes[0].id,
    ),
  ).toHaveLength(2);
});
test('variable controls build formulas, assigned values evaluate them, and equation results survive reload', async ({
  page,
}) => {
  await page.keyboard.press('Control+n');
  await addAt(page, 'Value', 180, 140);
  const a = cards(page).nth(0);
  await a.getByLabel('Value', { exact: true }).fill('A');
  await a.getByLabel('Value', { exact: true }).blur();
  await addAt(page, 'Value', 180, 480);
  const b = cards(page).nth(1);
  await b.getByLabel('Value', { exact: true }).fill('B');
  await b.getByLabel('Value', { exact: true }).blur();
  await addAt(page, 'Math Operation', 600, 180);
  const sum = cards(page).nth(2);
  await expect(sum.locator('[data-socket-name="operation"]')).toHaveCount(0);
  await expect(sum.getByLabel('operation', { exact: true })).toBeVisible();
  await expect(a.locator('[data-socket-output="false"]')).toHaveCount(0);
  await dragSocket(
    page,
    await socketPoint(a, 'value', true),
    await socketPoint(sum, 'a', false),
  );
  await dragSocket(
    page,
    await socketPoint(b, 'value', true),
    await socketPoint(sum, 'b', false),
  );
  await expect(sum.locator('pre').last()).toHaveAttribute(
    'aria-label',
    'A + B',
  );
  await a.getByLabel('Assign numerical value', { exact: true }).check();
  await a.getByLabel('Assigned value', { exact: true }).fill('2');
  await a.getByLabel('Assigned value', { exact: true }).blur();
  await b.getByLabel('Assign numerical value', { exact: true }).check();
  await b.getByLabel('Assigned value', { exact: true }).fill('3');
  await b.getByLabel('Assigned value', { exact: true }).blur();
  await expect(sum.locator('pre').last()).toHaveAttribute(
    'aria-label',
    'A + B = 5',
  );
  await page.keyboard.press('Control+z');
  await expect(b.getByLabel('Assigned value', { exact: true })).toHaveValue(
    '0',
  );
  await page.keyboard.press('Control+y');
  await expect(sum.locator('pre').last()).toHaveAttribute(
    'aria-label',
    'A + B = 5',
  );
  await addAt(page, 'Equation', 1040, 180);
  const eq = cards(page).nth(3);
  await eq.getByLabel('right', { exact: true }).fill('5');
  await eq.getByLabel('right', { exact: true }).blur();
  await dragSocket(
    page,
    await socketPoint(sum, 'result', true),
    await socketPoint(eq, 'left', false),
  );
  await expect(eq.locator('pre').last()).toHaveAttribute(
    'aria-label',
    'A + B = 5',
  );
  await saved(page);
  await page.screenshot({ path: 'test-results/symbolic-equation.png' });
  await page.reload();
  await expect(cards(page).nth(3).locator('pre').last()).toHaveAttribute(
    'aria-label',
    'A + B = 5',
  );
});

test('upgrading a saved graph preserves nodes and adds symbolic nodes while removing old control wires', async ({
  page,
}) => {
  await saved(page);
  await page.evaluate(() => {
    localStorage.setItem('mn_builtin_revision', '2026-10-26-functional');
    const definitions = JSON.parse(localStorage.getItem('mn_nodes') || '[]');
    localStorage.setItem(
      'mn_nodes',
      JSON.stringify(
        definitions.filter(
          (d: { id: string }) =>
            !['math.variable', 'math.equation'].includes(d.id),
        ),
      ),
    );
    const tabs = JSON.parse(localStorage.getItem('mn_saved_tabs') || '[]');
    tabs[0].connections.push({
      id: 'old-control-link',
      fromNodeId: 'node-demo-val1',
      fromSocket: 'value',
      toNodeId: 'node-demo-op',
      toSocket: 'operation',
    });
    localStorage.setItem('mn_saved_tabs', JSON.stringify(tabs));
  });
  await page.reload();
  await expect(cards(page)).toHaveCount(4);
  await expect(
    cards(page).nth(2).locator('[data-socket-name="operation"]'),
  ).toHaveCount(0);
  await expect(cards(page).nth(3).locator('pre').last()).toHaveText('42');
  expect((await saved(page)).connections).toHaveLength(3);
  await page.keyboard.press('Tab');
  await page.getByRole('combobox', { name: 'Search nodes' }).fill('Value');
  await expect(
    page
      .getByRole('option')
      .filter({ hasText: /^Value/ })
      .first(),
  ).toBeVisible();
});
test('Make Node creates a reusable whole-square node, inspects it, and shares a portable mnode', async ({
  page,
  browser,
}) => {
  test.setTimeout(60000);
  const point = await wireMidpoint(page, 2);
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert Node…' }).click();
  await page
    .getByRole('combobox', { name: 'Search nodes' })
    .fill('Math Function');
  await page.keyboard.press('Enter');
  await cards(page)
    .last()
    .getByLabel('func', { exact: true })
    .selectOption('x^2');
  await cards(page).last().getByLabel('func', { exact: true }).blur();
  await expect(cards(page).nth(3).locator('pre').last()).toHaveText('1764');
  await page.mouse.click(1250, 800);
  await page.keyboard.press('Control+a');
  await cards(page)
    .first()
    .locator('[data-node-header]')
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Make Node', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Make Node', exact: true });
  await dialog.getByLabel('Name', { exact: true }).fill('Whole Square');
  await dialog.getByLabel('Input label value_a').fill('A');
  await dialog.getByLabel('Input label value_b').fill('B');
  await dialog.getByLabel('Output label view_result').fill('Result');
  await dialog
    .getByRole('button', { name: 'Create Node', exact: true })
    .click();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).locator('pre').last()).toHaveText('1764');
  await cards(page).getByLabel('A', { exact: true }).fill('2');
  await cards(page).getByLabel('A', { exact: true }).blur();
  await cards(page).getByLabel('B', { exact: true }).fill('3');
  await cards(page).getByLabel('B', { exact: true }).blur();
  await expect(cards(page).locator('pre').last()).toHaveText('25');
  await cards(page).getByRole('button', { name: 'Open node contents' }).click();
  const inside = page.getByRole('dialog', { name: 'Inside Whole Square' });
  await expect(inside.locator('[data-node-id]')).toHaveCount(5);
  await expect(inside.getByLabel('func', { exact: true })).toBeDisabled();
  await expect(inside.getByText('25', { exact: true }).last()).toBeVisible();
  await page.screenshot({ path: 'test-results/reusable-node-contents.png' });
  await inside.getByRole('button', { name: 'Close node contents' }).click();
  await saved(page);
  await page.reload();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).locator('pre').last()).toHaveText('25');
  await page.keyboard.press('Control+n');
  const newInstance = await addAt(page, 'Whole Square', 400, 250);
  await expect(newInstance.locator('pre').last()).toHaveText('1764');
  await page
    .getByRole('button', { name: 'Package Manager (Install & Organize Nodes)' })
    .click();
  await page.getByPlaceholder('Search nodes & folders...').fill('Whole Square');
  const downloadPromise = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download Whole Square', exact: true })
    .click();
  const file = await downloadPromise;
  const path = await file.path();
  expect(file.suggestedFilename()).toBe('Whole Square.mnode');
  const friendContext = await browser.newContext();
  const friend = await friendContext.newPage();
  await friend.addInitScript(() => {
    localStorage.setItem('mn_show_startup', 'false');
    localStorage.setItem(
      'mn_user_settings',
      JSON.stringify({
        showStartupModal: false,
        showMinimap: false,
        snapToGrid: true,
        gridDotSpacing: 24,
        autoSave: true,
      }),
    );
  });
  await friend.goto('/');
  await expect(cards(friend)).toHaveCount(4);
  await friend
    .getByRole('button', { name: 'Package Manager (Install & Organize Nodes)' })
    .click();
  await friend.locator('input[accept=".mnode,.json"]').setInputFiles(path!);
  await friend.keyboard.press('Escape');
  await friend.keyboard.press('Control+n');
  const imported = await addAt(friend, 'Whole Square', 400, 250);
  await expect(imported.locator('pre').last()).toHaveText('1764');
  await imported.getByLabel('A', { exact: true }).fill('4');
  await imported.getByLabel('A', { exact: true }).blur();
  await imported.getByLabel('B', { exact: true }).fill('5');
  await imported.getByLabel('B', { exact: true }).blur();
  await expect(imported.locator('pre').last()).toHaveText('81');
  await addAt(friend, 'Value', 100, 100);
  await dragSocket(
    friend,
    await socketPoint(cards(friend).last(), 'value', true),
    await socketPoint(cards(friend).first(), 'value_a', false),
  );
  await expect(cards(friend).first().locator('pre').last()).toHaveText('225');
  await addAt(friend, 'View Result', 1000, 200);
  await dragSocket(
    friend,
    await socketPoint(cards(friend).first(), 'view_result', true),
    await socketPoint(cards(friend).last(), 'input', false),
  );
  await expect(cards(friend).last().locator('pre').last()).toHaveText('225');
  await friendContext.close();
});
test('Make Group moves members together, keeps calculations, saves membership and supports undo and ungroup', async ({
  page,
}) => {
  await page.mouse.click(1250, 800);
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+g');
  const dialog = page.getByRole('dialog', { name: 'Make Group', exact: true });
  await dialog.getByLabel('Name', { exact: true }).fill('My Calculation');
  await dialog
    .getByRole('button', { name: 'Create Group', exact: true })
    .click();
  await expect(page.locator('[data-frame-id]')).toHaveCount(1);
  await expect(cards(page)).toHaveCount(4);
  await expect(cards(page).nth(3).locator('pre').last()).toHaveText('42');
  const before = await saved(page);
  expect(before.frames[0].nodeIds).toHaveLength(4);
  const header = await page.locator('[data-frame-header]').boundingBox();
  await page.mouse.move(header!.x + 80, header!.y + 16);
  await page.mouse.down();
  await page.mouse.move(header!.x + 153, header!.y + 59, { steps: 8 });
  await page.mouse.up();
  const moved = await saved(page);
  expect(moved.nodes[0].x).not.toBe(before.nodes[0].x);
  expect(moved.frames[0].x - before.frames[0].x).toBe(
    moved.nodes[0].x - before.nodes[0].x,
  );
  await page.keyboard.press('Control+z');
  const undone = await saved(page);
  expect(undone.frames[0].x).toBe(before.frames[0].x);
  expect(undone.nodes[0].x).toBe(before.nodes[0].x);
  await page.reload();
  await expect(page.locator('[data-frame-id]')).toHaveCount(1);
  await page.locator('[data-frame-header]').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Ungroup', exact: true }).click();
  await expect(page.locator('[data-frame-id]')).toHaveCount(0);
  await expect(cards(page)).toHaveCount(4);
  await page.keyboard.press('Control+z');
  await expect(page.locator('[data-frame-id]')).toHaveCount(1);
});

test('Make Node conversion can be undone and redone while the reusable definition stays in My Nodes', async ({
  page,
}) => {
  await page.mouse.click(1200, 800);
  await page.keyboard.press('Control+a');
  await cards(page)
    .first()
    .locator('[data-node-header]')
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Make Node', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Make Node', exact: true });
  await dialog.getByLabel('Name', { exact: true }).fill('Reusable Sum');
  await dialog
    .getByRole('button', { name: 'Create Node', exact: true })
    .click();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).locator('pre').last()).toHaveText('42');
  await page.keyboard.press('Control+z');
  await expect(cards(page)).toHaveCount(4);
  expect((await saved(page)).connections).toHaveLength(3);
  await page.keyboard.press('Control+y');
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).locator('pre').last()).toHaveText('42');
  await page.keyboard.press('Control+n');
  await addAt(page, 'Reusable Sum', 400, 200);
  await expect(cards(page).locator('pre').last()).toHaveText('42');
});
test('library hover shows a real node preview with socket and control details, without changing the graph', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Node Library', exact: true }).click();
  const entry = page.getByRole('button', {
    name: 'Add Math Operation',
    exact: true,
  });
  await entry.hover();
  const preview = page.getByRole('tooltip', {
    name: 'Math Operation preview',
    exact: true,
  });
  await expect(preview).toBeVisible();
  await expect(preview.locator('[data-node-preview-card]')).toHaveCount(1);
  await expect(
    preview.getByRole('region', { name: 'Inputs', exact: true }),
  ).toContainText('scalar');
  await expect(
    preview.getByRole('region', { name: 'Controls', exact: true }),
  ).toContainText('operation');
  await expect(preview.locator('[data-socket-name="operation"]')).toHaveCount(
    0,
  );
  await expect(cards(page)).toHaveCount(4);
  const entryBox = await entry.boundingBox(),
    box = await preview.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(entryBox!.x + entryBox!.width);
  await preview.hover();
  await page.waitForTimeout(250);
  await expect(preview).toBeVisible();
  await page.screenshot({ path: 'test-results/library-node-preview.png' });
  await page.mouse.move(1200, 850);
  await expect(preview).toHaveCount(0);
  await entry.hover();
  await expect(preview).toBeVisible();
  await entry.click();
  await expect(cards(page)).toHaveCount(5);
  await expect(preview).toHaveCount(0);
});
test('quick-add hover previews widgets, flips at the right edge, and keeps add and dismissal working', async ({
  page,
}) => {
  await page.mouse.dblclick(1360, 840);
  const search = page.getByRole('combobox', { name: 'Search nodes' });
  await search.fill('Matrix Multiply');
  const entry = page.getByRole('option').filter({ hasText: 'Matrix Multiply' });
  await entry.hover();
  const preview = page.getByRole('tooltip', {
    name: 'Matrix Multiply preview',
    exact: true,
  });
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute('data-placement', 'left');
  await expect(preview.locator('[data-node-preview-card] input')).toHaveCount(
    8,
  );
  const bounds = await preview.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1440);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(1000);
  await preview
    .getByText('Multiplies two 2x2 matrices A and B (C = A × B)', {
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Add node', exact: true }),
  ).toBeVisible();
  await expect(cards(page)).toHaveCount(4);
  await entry.click();
  await expect(cards(page)).toHaveCount(5);
  await expect(preview).toHaveCount(0);
});
test('keyboard navigation previews active results and search or Escape clears stale previews', async ({
  page,
}) => {
  await page.keyboard.press('Tab');
  const search = page.getByRole('combobox', { name: 'Search nodes' });
  await search.fill('math');
  await search.press('ArrowDown');
  await expect(page.getByRole('tooltip')).toBeVisible();
  await expect(search).toBeFocused();
  await search.fill('Constant');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.getByRole('option').filter({ hasText: 'Constant' }).hover();
  await expect(
    page.getByRole('tooltip', { name: 'Constant preview', exact: true }),
  ).toBeVisible();
  await search.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(
    page.getByRole('dialog', { name: 'Add node', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Node Library', exact: true }).click();
  const entry = page.getByRole('button', { name: 'Add Value', exact: true });
  await entry.focus();
  await expect(
    page.getByRole('tooltip', { name: 'Value preview', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
});
test('custom and created nodes preview safely without running their kernels', async ({
  page,
}) => {
  await page
    .getByRole('button', {
      name: 'Package Manager (Install & Organize Nodes)',
      exact: true,
    })
    .click();
  await page.locator('input[accept=".mnode,.json"]').setInputFiles({
    name: 'preview-only.mnode',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        id: 'test.preview-only',
        name: 'Preview Only',
        description: 'This kernel must never run during preview.',
        inputs: [
          { name: 'amount', type: 'scalar', default: 7, widget: 'number' },
        ],
        outputs: [{ name: 'result', type: 'scalar' }],
        code: '() => { throw new Error("Preview executed a kernel"); }',
      }),
    ),
  });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  await page
    .getByRole('combobox', { name: 'Search nodes' })
    .fill('Preview Only');
  await page.getByRole('option').filter({ hasText: 'Preview Only' }).hover();
  const preview = page.getByRole('tooltip', {
    name: 'Preview Only preview',
    exact: true,
  });
  await expect(preview).toBeVisible();
  await expect(preview).toContainText(
    'This kernel must never run during preview.',
  );
  await expect(preview.locator('[data-node-preview-card] input')).toHaveValue(
    '7',
  );
  await expect(preview).not.toContainText('Preview executed a kernel');
  await expect(cards(page)).toHaveCount(4);
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', {
      name: 'Package Manager (Install & Organize Nodes)',
      exact: true,
    })
    .click();
  await page
    .locator('input[accept=".mnode,.json"]')
    .setInputFiles('examples/whole_square.mnode');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  await page
    .getByRole('combobox', { name: 'Search nodes' })
    .fill('Whole Square');
  await page.getByRole('option').filter({ hasText: 'Whole Square' }).hover();
  const created = page.getByRole('tooltip', {
    name: 'Whole Square preview',
    exact: true,
  });
  await expect(created).toBeVisible();
  await expect(created).toContainText('5 internal nodes');
  await expect(
    created.getByRole('region', { name: 'Inputs', exact: true }),
  ).toContainText('A');
  await expect(
    created.getByRole('region', { name: 'Outputs', exact: true }),
  ).toContainText('Result');
});
test('single and multiple selection menus show only applicable actions and no corner status box', async ({
  page,
}) => {
  await expect(
    page.getByText('Local changes saved', { exact: false }),
  ).toHaveCount(0);
  await expect(page.getByText('Tab: add', { exact: false })).toHaveCount(0);
  await cards(page)
    .nth(2)
    .locator('[data-node-header]')
    .click({ button: 'right' });
  for (const name of [
    'Make Node',
    'Make Group',
    'Frame Selection',
    'Align Left',
    'Align Top',
    'Distribute Horizontally',
    'Distribute Vertically',
  ])
    await expect(page.getByRole('menuitem', { name, exact: true })).toHaveCount(
      0,
    );
  await expect(page.getByText('Rename…', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('menuitem', { name: 'Collapse', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await cards(page).first().locator('[data-node-header]').click();
  await cards(page)
    .nth(2)
    .locator('[data-node-header]')
    .click({ modifiers: ['Shift'] });
  await cards(page)
    .first()
    .locator('[data-node-header]')
    .click({ button: 'right' });
  await expect(
    page.getByRole('menuitem', { name: 'Make Node', exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole('menuitem', { name: 'Make Group', exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole('menuitem', { name: 'Frame Selection', exact: true }),
  ).toBeEnabled();
  await expect(page.getByText('Rename…', { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('menuitem', { name: /Align|Distribute/ }),
  ).toHaveCount(0);
});
test('disconnected reusable-node selections are disabled with a validation reason', async ({
  page,
}) => {
  await page.keyboard.press('Control+n');
  await addAt(page, 'Value', 220, 200);
  await addAt(page, 'View Result', 700, 200);
  await page.mouse.click(1250, 800);
  await page.keyboard.press('Control+a');
  await cards(page)
    .first()
    .locator('[data-node-header]')
    .click({ button: 'right' });
  const make = page.getByRole('menuitem', { name: 'Make Node', exact: true });
  await expect(make).toBeDisabled();
  await expect(make).toHaveAttribute('title', /Connect.*input.*output/i);
  await expect(
    page.getByRole('dialog', { name: 'Make Node', exact: true }),
  ).toHaveCount(0);
});
test('calculation errors mark their source red and affected wires red; fixing the value clears the marks', async ({
  page,
}) => {
  const operation = cards(page).nth(2),
    output = cards(page).nth(3),
    denominator = cards(page).nth(1).getByLabel('Value', { exact: true });
  await operation
    .getByLabel('operation', { exact: true })
    .selectOption('Divide (/)');
  await operation.getByLabel('operation', { exact: true }).blur();
  await denominator.fill('0');
  await denominator.blur();
  await expect(operation).toHaveAttribute(
    'data-node-error-kind',
    'calculation',
  );
  await expect(operation).toHaveCSS('border-top-color', 'rgb(239, 68, 68)');
  await expect(operation).toContainText('Division by zero');
  await expect(output).toHaveAttribute('data-node-error-kind', 'upstream');
  await expect(output).toHaveCSS('border-top-color', 'rgb(224, 176, 92)');
  const failedWire = page.locator('[data-wire-id="conn-3"]');
  await expect(failedWire).toHaveAttribute('data-wire-error', 'true');
  await expect(failedWire.locator('path').last()).toHaveAttribute(
    'stroke',
    '#EF4444',
  );
  await expect(page.locator('[data-wire-id="conn-1"]')).not.toHaveAttribute(
    'data-wire-error',
    'true',
  );
  await expect(cards(page).first()).not.toHaveAttribute('data-node-error-kind');
  await operation.locator('[data-node-header]').click();
  await page.keyboard.press('ArrowRight');
  await expect(operation).toHaveCSS('border-top-color', 'rgb(239, 68, 68)');
  await expect(output).toHaveAttribute('data-node-error-kind', 'upstream');
  await page.screenshot({
    path: 'test-results/calculation-error-location.png',
  });
  await denominator.fill('2');
  await denominator.blur();
  await expect(output.locator('pre').last()).toHaveText('12.5');
  await expect(operation).not.toHaveAttribute('data-node-error-kind');
  await expect(output).not.toHaveAttribute('data-node-error-kind');
  await expect(failedWire).not.toHaveAttribute('data-wire-error');
});
test('reusable node errors retain the internal graph and highlight the actual failing operator', async ({
  page,
}) => {
  await cards(page)
    .nth(2)
    .getByLabel('operation', { exact: true })
    .selectOption('Divide (/)');
  await cards(page).nth(2).getByLabel('operation', { exact: true }).blur();
  await page.mouse.click(1250, 800);
  await page.keyboard.press('Control+a');
  await cards(page)
    .first()
    .locator('[data-node-header]')
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Make Node', exact: true }).click();
  const create = page.getByRole('dialog', { name: 'Make Node', exact: true });
  await create.getByLabel('Name', { exact: true }).fill('Quotient');
  await create
    .getByRole('button', { name: 'Create Node', exact: true })
    .click();
  await expect(cards(page)).toHaveCount(1);
  await cards(page).getByLabel('Value B', { exact: true }).fill('0');
  await cards(page).getByLabel('Value B', { exact: true }).blur();
  await expect(cards(page)).toHaveAttribute(
    'data-node-error-kind',
    'calculation',
  );
  await cards(page).getByRole('button', { name: 'Open node contents' }).click();
  const inside = page.getByRole('dialog', { name: 'Inside Quotient' });
  const source = inside.locator(
    '[data-node-id][data-node-error-kind="calculation"]',
  );
  await expect(source).toHaveCount(1);
  await expect(source).toContainText('Division by zero');
  await expect(source).toHaveCSS('border-top-color', 'rgb(239, 68, 68)');
  await expect(inside.locator('[data-wire-error="true"]')).toHaveCount(1);
  await inside.getByRole('button', { name: 'Close node contents' }).click();
  await cards(page).getByLabel('Value B', { exact: true }).fill('2');
  await cards(page).getByLabel('Value B', { exact: true }).blur();
  await expect(cards(page).locator('pre').last()).toHaveText('12.5');
  await expect(cards(page)).not.toHaveAttribute('data-node-error-kind');
});

test('unified Value renders LaTeX fractions and roots, substitution evaluates, and invalid formulas recover', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles('examples/latex_formula.mathnode');
  await expect(cards(page)).toHaveCount(3);
  const formula = page.locator('[data-node-id="formula"]'),
    result = page.locator('[data-node-id="output"]'),
    substitute = page.locator('[data-node-id="bindings"]');
  await expect(result.locator('[data-formula-latex]').last()).toHaveAttribute(
    'data-formula-latex',
    /12\.5/,
  );
  await expect(result.locator('.katex-html .mfrac').last()).toBeVisible();
  await expect(result.locator('.katex-html .sqrt').last()).toBeVisible();
  await expect(
    result.getByRole('button', { name: 'Copy LaTeX' }),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/latex-formula-workspace.png' });
  await substitute
    .getByLabel('bindings', { exact: true })
    .fill('A=3, B=3, C=4');
  await substitute.getByLabel('bindings', { exact: true }).blur();
  await expect(result.locator('[data-formula-latex]').last()).toHaveAttribute(
    'data-formula-latex',
    /18/,
  );
  await formula.getByLabel('Value', { exact: true }).fill('\\frac{');
  await formula.getByLabel('Value', { exact: true }).blur();
  await expect(formula).toHaveAttribute('data-node-error-kind', 'calculation');
  await formula.getByLabel('Value', { exact: true }).fill('\\sqrt{9}');
  await formula.getByLabel('Value', { exact: true }).blur();
  await expect(formula).not.toHaveAttribute('data-node-error-kind');
  await expect(result.locator('[data-formula-latex]').last()).toHaveAttribute(
    'data-formula-latex',
    /3/,
  );
  await page.getByRole('button', { name: 'Node Library', exact: true }).click();
  await page.getByPlaceholder('Search math nodes...').fill('Variable');
  await expect(
    page.getByRole('button', { name: 'Add Variable', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Add Value', exact: true }),
  ).toBeVisible();
});

test('direct vector controls edit numeric arrays and invalid entries recover', async ({
  page,
}) => {
  await page.keyboard.press('Control+n');
  const norm = await add(page, 'Vector Length');
  const input = norm.getByLabel('v', { exact: true });
  await input.fill('6, 8');
  await input.blur();
  await expect(norm.locator('pre').last()).toHaveText('10');
  await input.fill('6, invalid');
  await input.blur();
  await expect(norm).toHaveAttribute('data-node-error-kind', 'calculation');
  await input.fill('[3, 4]');
  await input.blur();
  await expect(norm.locator('pre').last()).toHaveText('5');
  await expect(norm).not.toHaveAttribute('data-node-error-kind');
});
