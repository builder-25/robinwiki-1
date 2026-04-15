# Wiki Frontend (@robin/wiki)

Next.js 16 application with React 19, Tailwind CSS 4, and shadcn/ui v4.

## Key Facts

- Pure UI prototype — all data is hardcoded, no API calls
- Uses its own tsconfig.json (bundler resolution, react-jsx) — does NOT extend tsconfig.base.json
- Uses ESLint with eslint-config-next, not Biome
- shadcn v4 with base-nova style and @base-ui/react primitives
- Path alias: `@/*` maps to `./src/*`

## Dev Server

```bash
pnpm --filter @robin/wiki dev    # starts on port 3000
```

## Before Writing Code

Read `node_modules/next/dist/docs/` for Next.js 16 API reference — this version has breaking changes from training data.
