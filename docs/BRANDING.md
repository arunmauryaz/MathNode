# Official MathNode logo

The official mark is the app's blue, raised square with a white **M**. The wordmark reads **MATH NODE**.

The source of truth is `.btn-m-logo` in [`src/index.css`](../src/index.css) and the wordmark in [`TopBar.tsx`](../src/components/layout/TopBar.tsx). Keep its shape, typography, blue border, and lower raised edge. Use the provided assets when displaying the logo.

- [Icon](assets/icon.png)
- [Icon and wordmark](assets/logo-lockup.png)
- [README banner](assets/banner.png)

These PNGs capture the actual app rendering at high resolution. The banner SVG includes that same captured wordmark. The favicon and dialog logos use the same exported icon.

To regenerate, start the app, then run:

```sh
node scripts/generate-brand-assets.mjs http://localhost:3000
```
