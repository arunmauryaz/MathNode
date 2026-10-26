import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
const url = process.argv[2] || 'http://localhost:3000';
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ||
    (process.platform === 'win32'
      ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
      : undefined),
});
try {
  const page = await browser.newPage({
    viewport: { width: 1400, height: 600 },
    deviceScaleFactor: 8,
  });
  await page.goto(url);
  await page.locator('.btn-m-logo').waitFor();
  await page.evaluate(() => document.fonts.ready);
  const size = await page.evaluate(() => {
    const original = document.querySelector('.btn-m-logo'),
      wordmark = original.nextElementSibling;
    if (
      original.textContent.trim() !== 'M' ||
      wordmark.textContent.trim() !== 'MATH NODE'
    )
      throw Error('Official app logo not found');
    const brand = document.createElement('div');
    brand.id = 'official-brand';
    Object.assign(brand.style, {
      position: 'fixed',
      left: '4px',
      top: '4px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    });
    brand.append(original.cloneNode(true), wordmark.cloneNode(true));
    document.body.append(brand);
    const style = document.createElement('style');
    style.textContent =
      'html,body{background:transparent!important}#root{display:none}';
    document.head.append(style);
    const r = brand.getBoundingClientRect();
    return { width: Math.ceil(r.right + 4), height: 42 };
  });
  await page.mouse.move(1300, 500);
  const icon = await page.screenshot({
    omitBackground: true,
    clip: { x: 0, y: 0, width: 40, height: 42 },
  });
  const lockup = await page.screenshot({
    omitBackground: true,
    clip: { x: 0, y: 0, ...size },
  });
  await writeFile('docs/assets/icon.png', icon);
  await writeFile('docs/assets/logo-lockup.png', lockup);
  await writeFile('public/favicon.png', icon);
  let banner = await readFile('docs/assets/banner.svg', 'utf8');
  // Replace the old invented mark and wordmark, or the previous official lockup.
  banner = banner.replace(
    /<g transform="translate\(56 56\) scale\(\.63\)">[\s\S]*?<\/g><\/g><\/g>/,
    '',
  );
  banner = banner.replace(/<text x="134"[^>]*>MathNode<\/text>/, '');
  banner = banner.replace(/<image id="official-logo"[^>]*\/>/, '');
  const logo = `<image id="official-logo" x="56" y="50" width="${size.width * 2}" height="84" href="data:image/png;base64,${lockup.toString('base64')}"/>`;
  banner = banner.replace(
    '<g font-family="Inter,Segoe UI,Arial,sans-serif">',
    logo + '<g font-family="Inter,Segoe UI,Arial,sans-serif">',
  );
  await writeFile('docs/assets/banner.svg', banner);
  const preview = await browser.newPage({
    viewport: { width: 1400, height: 440 },
    deviceScaleFactor: 1,
  });
  await preview.setContent(banner);
  await preview.addStyleTag({
    content:
      'html,body{margin:0;padding:0;background:#111820}svg{display:block}',
  });
  const bannerPng = await preview.screenshot();
  await writeFile('docs/assets/banner.png', bannerPng);
  await writeFile('docs/assets/social-preview.png', bannerPng);
  console.log(
    'Generated the official icon, wordmark, banner, favicon, and preview directly from the app.',
  );
} finally {
  await browser.close();
}
