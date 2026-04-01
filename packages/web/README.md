# @porta/web

React SPA frontend for Porta. Built with Vite + TypeScript, deployed as static files.

## Development

```bash
pnpm dev        # Start Vite dev server (http://localhost:5173)
pnpm build      # Production build → dist/
pnpm lint       # ESLint
pnpm test       # Vitest
```

## Architecture

- **Router:** React Router v7 — hash-based routing for static hosting compatibility.
- **State:** React hooks + context. No external state management library.
- **Styling:** Vanilla CSS with CSS custom properties.
- **PWA:** `vite-plugin-pwa` with `autoUpdate` strategy.
- **Markdown:** `marked` for rendering assistant responses.

## Build-time environment

| Variable        | Description                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE` | Absolute API URL for production builds. Leave unset during local dev (Vite proxies `/api/*` to the local proxy). |

The `envDir` in `vite.config.ts` is set to the repo root (`../..` from `packages/web`), so `.env*` files in the repo root are picked up automatically.
