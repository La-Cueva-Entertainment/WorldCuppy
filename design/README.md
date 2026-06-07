# Handoff: WorldCuppy "Matchday" Facelift

## Overview
A visual re-skin of **WorldCuppy** — a friend-group football pool app for the World Cup / Euros (snake draft, live standings, earnings tracking). This package re-styles the existing app under a new design system called **"Matchday"**: a confident, modern sports-editorial look with a refined pitch-green identity, a kit-gold accent for money, real country flags, and full light + dark themes.

**This is a facelift, not a feature change.** The information architecture, routes, data model, and behaviors are unchanged. The goal is to map the existing app's screens onto the new visual system. No schema or API changes are implied.

The existing app is **Next.js (App Router) + Tailwind CSS v4 + Prisma + NextAuth**, with `flag-icons` already a dependency.

---

## About the Design Files
The files in `designs/` are **design references created in plain HTML/CSS/JS** — prototypes that demonstrate the intended look, layout, and interactions. They are **not** production code to drop in.

The task is to **recreate these designs in the existing Next.js + Tailwind codebase**, using its established patterns (server components, the existing `globals.css`, existing components in `web/components/`, Prisma data, NextAuth session). Reuse real data wiring that already exists; only the presentation layer changes.

The prototypes use vanilla JS to inject a shared nav and render mock data into the DOM. In the real app:
- The shared nav/chrome (`app.js`) → becomes a React layout component (the app already has `web/app/layout.tsx`).
- The mock data (`data.js`) → is replaced by real Prisma queries / server props already in the codebase.
- The styling (`styles.css`) → is the source of truth for tokens, and should be translated into the Tailwind v4 `@theme` config + component classes in `globals.css`.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, shadows, and interaction states are final and exact. Recreate the UI faithfully using the codebase's existing libraries. Values below are authoritative; when in doubt, read `designs/styles.css`.

---

## Design Tokens

All tokens are defined as CSS custom properties in `designs/styles.css` under `:root` (light) and `html.dark` (dark). Translate these into the Tailwind v4 `@theme` block.

### Color — Light
| Token | Hex | Use |
|---|---|---|
| `--paper` | `#f5f5f4` | page background (neutral, no green cast) |
| `--surface` | `#ffffff` | cards |
| `--surface-2` | `#efeff0` | inset/hover surfaces, segmented track |
| `--line` | `#e5e5e6` | borders |
| `--line-soft` | `#eeeeef` | row dividers |
| `--ink` | `#16171a` | primary text |
| `--ink-soft` | `#5b5d62` | secondary text |
| `--ink-faint` | `#8c8e95` | tertiary / labels |
| `--grass` | `#16864a` | primary brand green |
| `--grass-deep` | `#0e6c3a` | green hover / text-on-light |
| `--grass-ink` | `#0a4f2a` | darkest green (gradients) |
| `--grass-soft` | `#e1f0e6` | green tint backgrounds |
| `--gold` | `#c4912a` | accent / money |
| `--gold-deep` | `#a9791c` | gold hover / text |
| `--gold-soft` | `#f6ecd4` | gold tint backgrounds |
| `--hot` | `#c2492f` | live/urgent (timer low, losses) |
| `--hot-soft` | `#f6e0d9` | hot tint backgrounds |

### Color — Dark (neutral charcoal, NO green cast — this was an explicit requirement)
| Token | Hex |
|---|---|
| `--paper` | `#0e0e10` |
| `--surface` | `#17181b` |
| `--surface-2` | `#202125` |
| `--line` | `#2d2e33` |
| `--line-soft` | `#232429` |
| `--ink` | `#edeef1` |
| `--ink-soft` | `#9b9da4` |
| `--ink-faint` | `#6c6e76` |
| `--grass` | `#3bc279` |
| `--grass-deep` | `#2ea968` |
| `--grass-ink` | `#bdeccd` |
| `--grass-soft` | `#15291d` |
| `--gold` | `#e0b357` |
| `--gold-deep` | `#c79a3f` |
| `--gold-soft` | `#2a2415` |
| `--hot` | `#e07a60` |
| `--hot-soft` | `#2f201b` |

> **Dark mode note:** an earlier version had green-tinted neutrals; that was removed on purpose. Keep dark backgrounds true neutral; green appears only in accents, badges, money, and the pitch panels.

### Manager identity colors (8 managers, indexed 0–7)
Light: `#c2492f, #c4912a, #5a8a2f, #16864a, #2f7d86, #36639e, #6a4ea0, #a8407e`
Dark: `#e58163, #e0b357, #9ec56a, #3bc279, #5fb6c0, #7ba3d8, #a890e0, #d77fb4`
Applied via classes `.m0`–`.m7` which set `--m`; used for dots (`.mdot`), chips (`.m-chip`), and rail accents.

### Typography
Three Google Fonts:
- **Archivo** (400–900) — display/headings, nav, labels, buttons. Tight: `letter-spacing: -0.02em`, `line-height: 1.04`, weights 800–900 for headings.
- **Hanken Grotesk** (400–700) — body / UI text. `line-height: 1.45`.
- **Spline Sans Mono** (500–700) — all numbers: scores, money, timers, ranks, FIFA #. Always `font-variant-numeric: tabular-nums`.

Type roles:
- `h1`: `clamp(26px, 4vw, 38px)`, weight 800, Archivo.
- `h2` (section): `clamp(20px, 2.4vw, 26px)`.
- `.kicker`: 11.5px, weight 700, `letter-spacing: .16em`, uppercase, `--ink-faint` (or `.grass` variant).
- `.money`: Spline Sans Mono 600; `.money.pos` = grass, `.money.gold` = gold.

### Spacing / Radius / Shadow
- Radii: `--r-sm 8px`, `--r-md 12px`, `--r-lg 16px`, `--r-xl 22px`.
- Nav height `--nav-h: 60px`; content max width `--maxw: 1180px`; page gutter `clamp(16px, 4vw, 32px)`.
- Shadows: `--shadow-sm/md/lg` (see file; lighter in light theme, deeper in dark).
- Section vertical padding: `clamp(20px, 3.5vw, 38px)` top, 90px bottom (72px mobile).

---

## Shared Components (translate to reusable React components)

### Top nav (`app.js` → layout component)
- Sticky, `backdrop-filter: blur`, 1px bottom border, height 60px, centered to `--maxw`.
- Left: **brand** = football-roundel SVG mark (`.brand .ball`, see below) + wordmark "World**Cuppy**" (the "Cuppy" in gold).
- Center: nav links (Home, Standings, Draft, My Teams, News) + optional gold "Admin" link. Active link has a 2.5px grass underline.
- Right: theme toggle (sun/moon icon button), avatar (initial in a grass circle, links to Profile), and a burger button (mobile only).
- **Theme**: persisted in `localStorage` under key `wc_theme` ("light"/"dark"); falls back to `prefers-color-scheme`. Toggling sets `.dark` on `<html>`.
- **Mobile (≤860px)**: nav links hide, burger shows; opens a right-side slide-in drawer (`.drawer` + `.drawer-back` scrim).

### Brand ball mark
An inline SVG (data-URI in `styles.css` under `.brand .ball`): white circle, `--grass-deep` 1.7px stroke, a solid green center pentagon and five short seam lines. 27×27px. Reproduce as a real `<svg>` React component for crispness.

### Buttons (`.btn`)
Archivo 700, height 42px (`.btn-sm` = 34px), radius 12px. Variants: `.btn-primary` (grass, white), `.btn-gold` (gold bg, dark text), `.btn-ghost` (surface + border), `.btn-dark`. `:active` nudges `translateY(1px)`.

### Badges, tiers, chips
- `.badge` — pill, 24px, Archivo 700 12px. Variants `.grass`, `.gold`, `.hot`. `.live-dot` = blinking dot (1.6s).
- `.tier` — tier label pill with a leading square swatch. `.tier-1` gold (Contenders), `.tier-2` grass (Dark horses), `.tier-3` blue (Mid pack), `.tier-4` purple (Long shots).
- `.m-chip` — manager chip tinted with that manager's `--m` color; `.mdot` = the color dot.

### Flags
`flag-icons` (already a dependency). Helper `WC.flag(code, size)` outputs `<span class="fi fi-XX fi-rect flag-SIZE">`. Sizes: `flag-sm` 19×13, `flag-md` 24×17, `flag-lg` 30×21, `flag-xl` 40×28. `.fi-rect` adds radius + inset hairline. Country→ISO mapping is in `data.js` (`fi` field), e.g. England = `gb-eng`.

### Tables (`.tbl`)
Header: Archivo 700 11px uppercase `.1em` tracking, `--ink-faint`, 1px bottom border. Rows: 11px/12px padding, dashed-soft dividers, hover = `--surface-2`. `.r` right-aligns. On mobile, wrap in `.tbl-scroll` (horizontal scroll) and the table gets `min-width: 460px`.

### Segmented control (`.seg`)
Inset track (`--surface-2`), 1px border, radius 11px, 3px pad. Active button = surface bg + small shadow. On mobile becomes horizontally scrollable (scrollbar hidden).

### Pitch panel (`.pitch-panel`)
The signature green surface: a diagonal green gradient (`#1a8a4e → #0c5e34` light / `--grass-deep → --grass-ink` dark) overlaid with faint vertical "mowed pitch" stripes (`repeating-linear-gradient`, 60px bands). White text. Used on the Home hero, Draft clock bar, Landing hero/CTA, Profile install card, Login promo side.

---

## Screens / Views

> Every screen is centered to `--maxw` (1180px) with `clamp` gutters, has the shared nav, supports light/dark, and is mobile-verified (no horizontal overflow at 390px; grids stack). Mock data lives in `designs/data.js`; wire to real Prisma/session data.

### 1. Home / Dashboard — `Home.html`
- **Purpose**: At-a-glance landing after sign-in — your position, today's matches, leaderboard, news.
- **Layout**: Page header (kicker "Group Stage · Live" + h1 "World Cup 2026" + "N matches today" hot badge). Below: 2-col grid `1fr / 332px` (collapses to 1 col ≤940px). Left column (gap 26px): hero, today's matches, mini leaderboard. Right: sticky news rail (`top: 80px`).
- **Hero** (`.pitch-panel`, radius `--r-xl`): "Your position" → big rank "1st" (Archivo 900, `clamp(54–84px)`) beside "Earnings $81.75" (gold, Spline mono). Row of owned-team flags (`flag-xl`). Right side (hidden on small): "Lead over 2nd +$12.25" + gold "Full standings →" button.
- **Today's matches**: 2-col card grid (1 col ≤620px). Each `.match` card: stage kicker + "Final" badge or kickoff time; two team lines (flag + name + score), loser dimmed to 50%; a payouts row of manager chips with `+$5.00` for winners.
- **Mini leaderboard**: card, top 5 rows; your row highlighted with `--grass-soft` bg; pos, color dot, name, money.
- **News rail**: card, top 4 headlines (tag badge, title, source · time).

### 2. Draft Console — `Draft.html`  ⭐ priority screen
- **Purpose**: The live snake-draft room. **Per the product owner: the team list is RANDOMIZED (not rank-sorted) so there's no rank-scanning advantage. Tier does NOT order the list — tier only determines the "jump" payout.**
- **Layout**: Page header (18 of 32 picked). Full-width **clock bar** (`.pitch-panel`): "● On the clock" label + "Your pick, Nico" + "Round 3 · Pick 3 of 8" on the left; big mono countdown timer on the right (turns `--hot`/`.low` color when low). Then a 2-col grid `272px / 1fr` (stacks ≤900px).
  - **Left rail** (`.card`, sticky `top:78px`): "Draft order" — 8 manager rows in pick order. Active manager row outlined/tinted in their color and shows the live timer; others show a 4-square roster-fill indicator (filled squares = teams drafted).
  - **Right board**: controls row (tier segmented filter: All / Contenders / Dark horses / Mid pack / Long shots, + a "Find a team" search box). A note: "Order is randomized — no rank advantage. Tier sets the jump payout." Then the **team table** (in `.tbl-scroll`): columns Flag · Team · "Tier · payout" (tier pill + payout text) · FIFA # (mono) · Pick action. Available teams show a grass "Draft" button; taken teams show the owner's manager chip and dim to ~62%; your own picks get a faint grass row highlight.
  - Below the table: **"How tiers pay — jumps"** legend (4 tier cards with range + payout), explanatory copy, and a **"Recent picks" ticker** (horizontal scroll of last 10 picks: #pick, flag, team, manager name in their color).
- **Randomization detail**: in the prototype the order is a seeded shuffle (`WC.shuffle(TEAMS, 42)`) so it's stable per load. In production, randomize the draft-pool ordering server-side per draft.
- **Tiers → jump payouts** (confirm exact math with product owner): Tier 1 Contenders `FIFA #1–6` = base; Tier 2 Dark horses `#7–12` = +$1/jump; Tier 3 Mid pack `#13–18` = +$2/jump; Tier 4 Long shots `#19+` = +$3/jump. A "jump" = your team beating a higher-tier team in the knockouts.

### 3. Standings — `Standings.html`
- **Purpose**: Full leaderboard + knockout bracket + payout rulebook.
- **Layout**: header with a Leaderboard/Bracket segmented control (Bracket smooth-scrolls down). 2-col `1fr / 300px` (stacks ≤940px).
  - **Leaderboard card**: rows `48px / 1fr / auto`. Rank number (gold/silver/bronze for top 3), name + color dot, row of owned flags (`flag-md`), earnings (mono) + delta to leader. Your row tinted grass.
  - **Sidebar** (sticky): "Prize money $640" card; "Payout rules" card — label/value rows (Group win $3.00, Group tie $1.00, Goal difference $0.25, R16 $5.00, QF $10.00, SF $15.00, 3rd $10.00, Runner-up $10.00, 🏆 Champion $20.00).
  - **Bracket** (below, full width, horizontal scroll): 4 columns R16 → QF → SF → Final. Each `.br-match`: two team lines with flag, name, score (mono; "p" suffix on penalty winner), an owner color dot; winner emphasized, loser dimmed; TBD slots italic. Final column ends with a gold "🏆 Champion · $20" badge.

### 4. My Teams / Lineup — `Lineup.html`
- **Purpose**: Your drafted squad with per-team earnings + form.
- **Layout**: header (kicker "Nico · World Cup 2026" + h1 "My Teams" + "Go to draft →"). 3 summary stat cards (Total earnings / Pool position / Teams drafted), stacks to 1 col ≤620px. Then a column of team cards: each `.tcard` is `auto / 1fr / auto` — crest flag (62×44), name (Archivo 800 21px) + tier pill + FIFA # + form chips (W/D/L colored squares: grass/ink-faint/hot) + next-match line; right side = earned amount (mono). Then a dashed `.slot-empty` card for the remaining undrafted pick (gold "1 pick remaining" badge + CTA).

### 5. News — `News.html`
- **Purpose**: Aggregated football news (RSS-style).
- **Layout**: header + "Live RSS" badge. 2-col `1fr / 320px` (stacks ≤940px). Left: a **feature** card (placeholder photo thumb + tag badge + large headline + lead + source·time), then a list of `.arow` items (132px thumb / 1fr text; stacks ≤540px). Right sticky: "Latest scores" card (compact flag · name · score rows) + "Sources" card (pills). Thumbnails are striped placeholders — **wire to real article images/RSS**.

### 6. Profile — `Profile.html`
- **Purpose**: Manager profile, history, settings.
- **Layout**: profile header (84px rounded-square grass avatar with initial + name + email + manager-color chip + "Sign out"). 2-col `1fr / 320px` (stacks ≤920px). Left: 4 stat cards (Tournaments / Total won / Best finish / Teams drafted) + "Tournament history" card (year, name, finish badge [win=gold / pod=grass / mid=neutral], earnings). Right: "Settings" card with toggle switches (Dark mode toggle is wired to the theme system; Discord pings; Match alerts) + a green "Install WorldCuppy" PWA card.

### 7. Landing (signed-out) — `Landing.html`
- **Purpose**: Marketing hero for logged-out visitors.
- **Layout**: minimal landing nav (brand + theme + "Sign in" / "Create account"). **Hero** (`.pitch-panel`): 2-col `1.05fr / .95fr` (stacks ≤880px) — left: badge, huge headline "Pick nations. Win the **pool**." (pool in gold), tagline, CTAs (gold "Create your account" + ghost "See a live pool →"), trust stats row; right: a tilted glassmorphic "Live standings" floating card. Below: 3 feature cards (Every tournament / Fair snake draft / Live earnings), a 4-step "How it works" row, and a green CTA band.

### 8. Login / Register — `Login.html`
- **Purpose**: Auth. Single file toggles between sign-in and register via `?mode=register` and an in-page link.
- **Layout**: full-viewport 2-col split (`1fr / 1fr`; the promo side hides ≤840px, form centers). Left **promo** (`.pitch-panel`): brand, headline, tagline, mini live-standings card. Right **form**: brand + theme toggle, title/subtitle (swap by mode), fields (Display name shown only in register mode, Email, Password), primary submit, "or" divider, "Continue with Google" button (use existing NextAuth Google provider), and a mode-switch link. Inputs: 46px, radius 11px, grass focus ring (`0 0 0 3px --grass-soft`). **Wire to existing NextAuth flow** — don't reimplement auth.

---

## Interactions & Behavior
- **Theme toggle**: sets `.dark` on `<html>`, persists to `localStorage["wc_theme"]`, initial value from storage or `prefers-color-scheme`. Several pages have their own toggle button — in React, centralize in one theme provider.
- **Mobile nav**: burger opens right slide-in drawer (`transform: translateX` 0.24s) with a scrim; click scrim to close. Nav links hide ≤860px.
- **Draft tier filter**: segmented control filters the team table by tier (client-side in proto). Search box filters by team name (case-insensitive substring).
- **Draft countdown**: static `0:47` in the proto; real app drives it from the server pick deadline and applies `.low` styling under a threshold (e.g. <15s) → timer turns `--hot`.
- **Standings segmented control**: "Bracket" smooth-scrolls to the bracket section.
- **Login mode switch**: toggles `body.register` class (reveals Display name field) and swaps button/title/link copy.
- **Hover/active states**: buttons darken + `translateY(1px)` on active; nav links get `--surface-2` bg; table rows highlight; stickers/cards lift slightly. All defined in `styles.css`.
- **Animations**: `.live-dot` blink (1.6s); avoid decorative infinite loops elsewhere. Respect `prefers-reduced-motion` in production.

## Responsive Behavior
Mobile-verified at 390px for all 7 screens: zero horizontal overflow. Key breakpoints: 940px (Home/News/Standings/Profile → 1 col), 920/900px (Profile/Draft stack), 880/860px (Landing stack / nav→burger), 840px (Login promo hides), 620px (match grid / summary stats → 1 col; segmented controls scroll; tables get `min-width` + `.tbl-scroll`), 540px (news rows stack), 440px (nav tightens). See the `@media` blocks at the bottom of `styles.css`.

## State Management
Mostly server-rendered in the real app. Client state needed:
- **Theme** (light/dark) — provider + localStorage.
- **Draft**: tier filter + search query (local); live pick state, current picker, countdown, pick history (from server — the existing draft already has live updates; reuse that mechanism).
- **Login**: mode (login/register) — local.
- Standings view toggle, mobile drawer open — local.

## Design Tokens → Tailwind
Translate the `:root` / `html.dark` custom properties in `styles.css` into the Tailwind v4 `@theme` block in `web/app/globals.css` (the project already uses `@custom-variant dark`). Component-level classes (`.btn`, `.badge`, `.tier`, `.card`, `.pitch-panel`, `.m-chip`, `.tbl`, `.seg`, `.flag-*`) can be ported as `@layer components` utilities or as React component variants — your call based on the codebase's conventions.

## Assets
- **Fonts**: Archivo, Hanken Grotesk, Spline Sans Mono (Google Fonts — the project already uses `next/font`; swap the current Geist for these).
- **Flags**: `flag-icons` package (already a dependency). Country→ISO map in `data.js`.
- **Brand ball**: inline SVG (in `styles.css` `.brand .ball`) — reproduce as an SVG React component.
- **Icons**: small inline SVGs (search, sun/moon, burger, chevrons, feature glyphs) — replace with the project's icon set if it has one.
- **No raster images** are required; news thumbnails are placeholders to be wired to real RSS images.

## Files
In `designs/`:
- `styles.css` — **the design system / source of truth for all tokens + components**.
- `app.js` — shared nav + theme + mobile drawer logic (→ React layout).
- `data.js` — mock data + helpers (`flag`, `money`, `ownerOf`, `shuffle`, etc.) — replace with real data.
- `Home.html`, `Draft.html`, `Standings.html`, `Lineup.html`, `News.html`, `Profile.html`, `Landing.html`, `Login.html` — the eight screens.

Open any HTML file directly in a browser to see the live design (light/dark toggle in the nav).
