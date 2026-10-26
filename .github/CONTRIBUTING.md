# Contributing

Use Node.js 22.3+ and npm 10.5+.

```sh
npm ci
npm run dev
```

Before submitting a change:

```sh
npm run build
npm test
```

Tests use Chrome on Windows or Playwright Chromium elsewhere. Install the latter with `npx playwright install --with-deps chromium`. Set `CHROME_PATH` to use another local Chrome executable.

- New mathematical nodes: follow the [SDK guide](../docs/NODE_AUTHORING.md), add a known-answer example, and verify invalid domains.
- Agent tools: update the [MCP guide](../docs/MCP_AGENT_GUIDE.md) and integration tests.
- UI changes: follow the [design guide](../mathnode-design-guide.md) and include a screenshot.

Keep pull requests focused. Explain the behavior changed and how it was checked.
