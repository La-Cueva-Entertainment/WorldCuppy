# WorldCuppy icon — "Cuppy" Trophy (option A)

Brand mark: a gold trophy on a green rounded tile. Bold enough to stay legible at 16px.

## Files

| File | Use |
|---|---|
| `worldcuppy-mark.svg` | The trophy mark alone, `fill: currentColor` — recolor freely (gold, white, ink). Use inline in nav/headers. |
| `worldcuppy-icon.svg` | Full app icon — gold trophy on green rounded tile. Vector favicon + source of the PNGs. |
| `worldcuppy-maskable.svg` | Full-bleed version (extra padding) for Android "maskable" icons. |
| `favicon-16.png` / `favicon-32.png` / `favicon-48.png` | Browser tab favicons. |
| `apple-touch-icon.png` | 180×180 — iOS home-screen icon. |
| `icon-192.png` / `icon-512.png` | PWA / Android icons (`purpose: any`). |
| `icon-512-maskable.png` | PWA icon (`purpose: maskable`). |

## Wire it up (Next.js App Router)

Put the PNGs + SVGs in `web/public/icon/`. Either drop these in `app/` for file-based metadata, or add to your metadata export:

```ts
// web/app/layout.tsx
export const metadata = {
  icons: {
    icon: [
      { url: "/icon/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon/worldcuppy-icon.svg", type: "image/svg+xml" },
    ],
    apple: "/icon/apple-touch-icon.png",
  },
};
```

Plain HTML equivalent:

```html
<link rel="icon" type="image/svg+xml" href="/icon/worldcuppy-icon.svg" />
<link rel="icon" type="image/png" sizes="32x32" href="/icon/favicon-32.png" />
<link rel="icon" type="image/png" sizes="16x16" href="/icon/favicon-16.png" />
<link rel="apple-touch-icon" href="/icon/apple-touch-icon.png" />
```

## PWA manifest

```json
{
  "name": "WorldCuppy",
  "short_name": "WorldCuppy",
  "theme_color": "#0c5e34",
  "background_color": "#0e0e10",
  "icons": [
    { "src": "/icon/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icon/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icon/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

## The nav brand mark
In the live designs the nav uses this same trophy-on-green-tile as a 28px rounded square (`.brand .ball` in `styles.css`). To reproduce in React, render `worldcuppy-mark.svg` (gold fill) inside a 28×28 green rounded container, or just use `worldcuppy-icon.svg` directly.

## Colors
- Tile gradient: `#1a8a4e → #0c5e34`
- Trophy: `#f0d98a` (soft gold; matches the kit-gold accent family `--gold #c4912a`)

## Note on .ico
Modern browsers use the PNG/SVG links above; a `.ico` isn't required. If you need one for legacy support, run `favicon-16/32/48.png` through any PNG→ICO tool.
