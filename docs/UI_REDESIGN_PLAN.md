# ReLivR — UI Redesign Plan

> Status: **DRAFT for approval** · Authored 2026-07-13 · Owner sign-off required before Phase 1.
> Scope: visual/interaction redesign of the existing single-file React app (`frontend/src/App.jsx`).
> Companion pitch artifact (mashup research, visual): the "ReLivR — UI Redesign Plan" artifact.

This is a **refinement, not a rebrand.** The purple/orchid palette, Inter typography, the layered
shadow scale, and the Batch-6 two-track "How it works" all stay. The problem ReLivR has is not taste
— it's that several structural choices read as *machine-generated* rather than *designed*, and the
brand voice is quieter than it has earned the right to be. This plan fixes that in ordered phases,
lowest-risk first, each shippable and live-verifiable under the existing batch protocol.

---

## 0. TL;DR

| | |
|---|---|
| **Keep** | Purple/orchid palette, Inter + mono-eyebrow type, shadow scale, `.reveal` scroll-in, two-track How-It-Works, the trust/escrow model. |
| **Fix (bugs)** | Hero subhead still says "ReLivR connects students" (contradicts the open-to-everyone rebrand); leftover "students" in business/admin microcopy. |
| **Change (the slop tells)** | Replace 156 emoji + 141 unicode-glyph "icons" with **one real SVG icon set**; de-template the hero (kill the dot-grid + glow-blob + floating-phone silhouette); drop the coloured left-rail on task cards; collapse the radius zoo; vary hover by affordance. |
| **Add** | Two semantic accent tokens — **Verified** (green) and **Live** (blue) — so trust/presence stop borrowing brand-purple. Surface the ID/student verification we already built on cards, not just settings. |
| **North star** | *A trustworthy, South-African, real-money local marketplace — populated, verified, alive.* Not a toy, not a template. |

---

## 1. Diagnosis — why the current UI reads as "AI-generated"

Measured against the live comps (TaskRabbit, Thumbtack, FreeUp, ProBuddy, Freedomly, Serv.co.za) and
counted directly out of `App.jsx`. Ordered by how much each one hurts.

1. **Copy regression bug (highest priority, not cosmetic).**
   [`App.jsx:1464`](../frontend/src/App.jsx#L1464) — the hero subhead reads *"ReLivR connects students…
   with verified student trust scores."* It is the most-read sentence on the site and directly
   contradicts the "open to everyone" positioning shipped in Batch 6. Fix regardless of everything else.

2. **No real icon system — 156 emoji + 141 unicode glyphs standing in for icons.**
   Counted: `✓`(29) `★`(19) `✕`(13) `📍`(9) `🔒`(7) `💬`(6) `🏷`(6) `🎓`(5) … and geometric glyphs
   `→`(62) `◇`(11) `◻`(6) `◷`(6) `◈`(5) `▦`(5) `▤`(4) `⌕`(2) `⌂`(1). **No icon library is installed**
   (`package.json` has none). This is the single biggest tell: emoji render per-OS/font and can't take a
   stroke colour; glyphs like `◷`/`⌕` don't sit on the text baseline. Real products ship one icon family
   with a fixed grid + stroke width.

3. **The hero is the canonical "generated SaaS landing" silhouette.**
   [`App.jsx:1450-1490`](../frontend/src/App.jsx#L1450) stacks, in this exact order: a dot-grid
   background + a soft radial-purple glow blob + a pill badge with a pulsing dot + a gradient-highlighted
   headline word + a fake phone frame (`border:10px solid #131118`, `borderRadius:40`) holding three
   cards bobbing on `animation:float`. Each element is fine alone; assembled in that arrangement it's the
   most recognisable Framer/v0 template shape there is.

4. **Pastel-emoji category chips.**
   [`App.jsx:2747-2754`](../frontend/src/App.jsx#L2747) — every category = an emoji (`💻📚🛵🎨✍️🎸📦✨`)
   plus a two-tone pastel gradient. Reads like a generated to-do app, not a marketplace where real money
   moves.

5. **Coloured left-border rail on every task card.**
   [`App.jsx:2956`](../frontend/src/App.jsx#L2956) — `borderLeft: 4px solid ${categoryColor}`. A coloured
   accent rail on a rounded card is a well-known generated-design shortcut (cheap colour-coding without
   designing the card).

6. **Uniform hover on everything.**
   `DCard` [`App.jsx:573`](../frontend/src/App.jsx#L573) lifts *every* surface — task, business, review,
   category — with the identical `translateY(-2px)` + big shadow. Real UIs vary feedback by what the
   thing does.

7. **Radius zoo.** 188 `borderRadius` declarations, many ad-hoc (`6/8/9/10/12/14/40/100/'50%'` mixed with
   the `--radius-*` tokens). Inconsistent corners are a low-key generated tell.

8. **Leftover "students" microcopy** (post-rebrand regression, business/admin facing): `App.jsx`
   [6190](../frontend/src/App.jsx#L6190), [7321](../frontend/src/App.jsx#L7321),
   [7399](../frontend/src/App.jsx#L7399), [7434](../frontend/src/App.jsx#L7434), 5258, 5304, 6480, 6626.

**What is NOT the problem:** the colour system and Inter are genuinely fine and align with what
TaskRabbit/Freedomly ship. Do not "fix" them.

---

## 2. Competitive read — one lesson each

| Site | Verified detail (live) | The lesson we take |
|---|---|---|
| **TaskRabbit** | Inter, pill buttons (r=1000px), H1 55/800, "Projects starting at $49", huge trust-stat bar | Price-anchor the offering; front-load trust stats |
| **Thumbtack** | Custom "Rise" face, 4px radius, H1 60/800, one bright CTA colour, "Trusted by 4.5M+ · 4.9/5" | Reserve one accent for CTAs; a proof line under the hero |
| **FreeUp** | Merriweather display / Nunito body, Entry/Mid/Expert pricing tiers | A serif reads deliberate; tiered pricing scans skill level |
| **ProBuddy** | 12px radius, system sans, category = 3 pills and nothing else | Restraint — one job per screen |
| **Freedomly** | Poppins 600, H1 56, named-person talent cards, "~48h · ~4.9/5 · 100+" stat trio | The person is the product; a 3-stat proof strip |
| **Serv.co.za** | Oswald 700/72px, SA B2B, POPIA copy, "30+ EXPERTS" counts, verified badges, guarantee triad | **Closest comp.** Live counts make a directory feel alive; a trust triad beats a "why us" paragraph |

---

## 3. Design north star & principles

**Positioning line (internal):** *ReLivR is a trustworthy, South-African, real-money local
marketplace — populated, verified, and alive.*

Six principles that every redesign decision below is derived from:

1. **Earned confidence.** Bigger, tighter display type where the brand has earned it (hero, section H2).
   Quiet everywhere else. (Serv/Thumbtack lesson.)
2. **One real icon system.** A single stroked SVG family, one grid, one weight. Icons carry meaning, not
   decoration. (The #1 de-slop move.)
3. **Semantic colour ≠ accent.** Purple = brand/CTA. Green = verified/safe. Blue = live/now. Each colour
   means exactly one thing every time it appears.
4. **Populated, not empty.** A young marketplace's worst enemy is looking dead. Counts, presence dots,
   real names, real reviews — surface the liveness the DB already tracks. (Serv/Freedomly lesson.)
5. **Restraint over flourish.** Remove template decoration (glow blobs, floating mock, dot-grids) rather
   than add more. (ProBuddy lesson.) Extra ornament is itself an AI tell.
6. **Motion with intent.** Vary interaction feedback by affordance; one signature scroll-reveal, not
   ambient bobbing everywhere. Respect `prefers-reduced-motion`.

---

## 4. Design-system changes (the foundation)

### 4.1 Colour — two new semantic tokens (add to `:root`, keep everything else)

```
--verified:  #0d7a5f;   /* TaskRabbit/Serv green — ID-verified, verified student, escrow-safe */
--verified-dim: #e6f4ef;
--live:      #009fd9;   /* Thumbtack blue — online now, real-time, urgent */
--live-dim:  #e3f4fb;
```
Dark-theme variants: `--verified:#34d399`, `--live:#38bdf8`. These are **semantic**, exactly like the
existing `--success`/`--danger`. Purple never again does "verified" or "online" duty.

### 4.2 Typography — turn up display, lock a scale

- Keep Inter. No new font license.
- Hero H1 already good after this session (clamp to ~5.2rem). Push **section H2** weight 800→**850/900**
  and tighten tracking to `-0.02em`; give all headings `text-wrap: balance`.
- Publish a **strict type scale** as tokens and stop hand-picking `fontSize` per element:
  `--fs-display / --fs-h1 / --fs-h2 / --fs-h3 / --fs-body / --fs-sm / --fs-eyebrow`. Migration is
  mechanical and can ride along with other passes.
- Keep the mono uppercase eyebrow — extend the same style to **badges and counts** (no new label
  language to learn).

### 4.3 Icons — **the flagship change**

**Decision: adopt [Lucide](https://lucide.dev) (MIT, tree-shakeable) via `lucide-react`, wrapped in one
`<Icon>` component.** Rationale: standard stroked family, one grid/weight, per-icon colour + size,
accessible, ~0 bundle cost when tree-shaken (only imported icons ship). If we choose zero-deps instead,
the same `<Icon>` component holds a **curated inline-SVG set** (~24 icons hand-lifted from Lucide/Feather,
still MIT) — the call-site API is identical, so the decision is reversible.

- Build `frontend/src/Icon.jsx`: `<Icon name="check|star|pin|lock|message|verified|clock|search|home|
  chevron-right|…" size={18} stroke={1.75} />`.
- **Map every emoji/glyph to a named icon** (≈24 distinct). Keep *genuinely expressive* emoji only where
  emoji is the right medium (e.g. the 🎓 student badge, 🇿🇦 SA flag, celebratory 🎉) — decide per case,
  default to the icon set.
- Swap at call sites in passes by surface (nav → cards → forms → admin). One component = one swap point,
  so it's safe and incremental.
- **Done when:** no bare emoji/glyph is used structurally as an icon; `grep` for the glyph set returns
  only deliberate, documented exceptions.

### 4.4 Radius & elevation discipline

- Collapse the 188 ad-hoc radii onto the four tokens (`--radius-sm 10 / -md 14 / -lg 20 / -xl 28`) +
  `--radius-pill`. Cards = `--radius-md`, chips/badges = pill, avatars = 50%, inputs = `--radius-sm`.
- Elevation: only three levels in product surfaces (`--shadow-sm` resting, `--shadow-md` raised,
  `--shadow-lg` overlay). Kill one-off `boxShadow` strings.

### 4.5 Motion

- `DCard` gains a `interactive` vs `static` distinction: only genuinely-clickable cards lift; static
  info cards get a subtle border-colour shift instead. (Fixes tell #6.)
- Remove ambient `animation:float` on the hero phone mock (removed with the hero rework anyway).
- Keep the one `.reveal` scroll-in as the signature. Guard all of it behind `prefers-reduced-motion`.

---

## 5. Section-by-section redesign

### 5.1 Landing hero — de-template *(tell #3)*
- **Remove:** dot-grid background, radial glow blob, floating phone frame with bobbing cards.
- **Replace with** one confident, composed idea: the big headline + the fixed subhead (bug-fixed) + the
  two CTAs + a **real proof line** built from `STATS_DATA` (which already exists —
  [`StatsBar`](../frontend/src/App.jsx#L1497)) pulled up under the CTA (Thumbtack/Serv pattern), and a
  single honest hero visual (a real, static task-feed snapshot styled as product — not a fake phone, not
  floating). Consider the Serv move: a live "N open tasks near you" count as the liveness signal.
- **Type:** headline stays large; ensure the gradient-highlight word doesn't read as the template trick —
  either keep it as the one deliberate flourish or drop it for a solid underline in `--accent`.

### 5.2 Category browse — populate it *(tells #2, #4)*
- Replace pastel-emoji chips with **icon + label + live count** ("Tutoring · 12 open"). Count needs a
  small aggregate endpoint (Phase 3); until then, hide the count gracefully rather than fake it.
- Real `<Icon>` per category; drop the two-tone gradient for a flat token background + accent icon.

### 5.3 Task cards — kill the rail, add trust *(tells #2, #5, #6)*
- Remove `borderLeft: 4px solid categoryColor` ([`App.jsx:2956`](../frontend/src/App.jsx#L2956)); encode
  category as a small **icon chip** in the card header instead.
- Add a **poster trust row**: avatar + name + `Verified` badge (`--verified`) + rating. The ID/student
  verification exists in data since Batch 3/6 but never shows on cards.
- Hover: only the card lifts (it navigates); the category chip and badges don't independently animate.

### 5.4 Available-Now rail — make "live" actually blue *(tell #2, principle 3/4)*
- Batch 4 already ships online + working-hours data. Change the presence dot from brand-purple to
  `--live`; add the `Verified` badge on the chip. (Right now verification only lives in Profile settings.)

### 5.5 Business profile — trust triad (Serv)
- Replace any generic "why us" prose with a **3-up guarantee triad** wired to real claims:
  *ID-verified owner · reviews only from completed jobs · local, SA-first.* Uses `--verified` + real
  `<Icon>`s.

### 5.6 How It Works — **leave it**
- The Batch-6 two-track (people / business) numbered layout already mirrors Serv/TaskRabbit. Only swap
  the emoji track-headers (`🙋`/`🏪`) for `<Icon>`s to match the new system.

### 5.7 Auth / onboarding
- Icon swap + radius/type-scale conformance only. No structural change.

---

## 6. Copy pass (rides in Phase 0)
- **Fix** the hero subhead [`1464`](../frontend/src/App.jsx#L1464) to the open-to-everyone voice
  (e.g. *"ReLivR connects your community. Post a task, earn money, or get it done — with verified,
  trust-scored members."*).
- Sweep the leftover business/admin "students" labels (5258, 5304, 6190, 6480, 6626, 7321, 7399, 7434)
  → "customers"/"people"/"members" as context fits. Keep genuine student-perk references
  (`student-only deals`, verified-student badge) intact.

---

## 7. Phased roadmap

Each phase ships under the existing batch protocol: tests green → build clean → live-verify → state-doc
entry → commit. Ordered by risk (reversibility), not glamour.

### Phase 0 — Copy & bug fixes · *minutes · zero risk*
- Hero subhead bug; leftover "students" labels.
- **Done when:** no pre-rebrand student positioning in user-facing copy; build clean.

### Phase 1 — Foundation · *~½ day · low risk, wide but mechanical*
- Add `--verified`/`--live` tokens (+ dark variants).
- Build `<Icon>` component; decide Lucide-dep vs inline-set; migrate **nav + top-level chrome** first.
- Publish the type-scale tokens; collapse the radius zoo onto tokens.
- **Done when:** `<Icon>` in use across chrome; two semantic tokens defined; no visual regressions.

### Phase 2 — Hero + cards · *~1 day · medium risk (visible)*
- De-template the hero (5.1); pull the proof line up.
- Task-card redesign: remove rail, add category icon-chip + poster trust row (5.3).
- `DCard` interactive/static split (4.5).
- Finish the icon migration across cards + forms.
- **Done when:** hero no longer matches the template silhouette; task cards show verification; emoji/glyph
  icon count ≈ 0 structurally.

### Phase 3 — Structural / liveness · *~1–2 days · higher risk (backend)*
- `GET /categories/counts` (or extend `/categories`) → live open-task count per category (5.2).
- Available-Now rail: `--live` dot + verified badge (5.4).
- Business-profile trust triad (5.5).
- Optional/v2: Freedomly-style **provider directory** distinct from task browse; FreeUp-style **tiered
  catalog pricing** (Batch-5 catalog already stores nullable prices).
- **Done when:** categories show real counts; presence reads blue; profiles show the triad.

---

## 8. Explicitly out of scope
- No new brand, no logo change, no colour-family overhaul (purple stays).
- No new font license (Inter stays).
- No framework/build change; still single-file `App.jsx` React + Vite.
- Not touching the SA-ID-required / self-serve-business-onboarding product decisions (separate track).

---

## 9. Risks & guardrails
- **Icon migration is wide** (many call sites). Mitigate: one `<Icon>` component = one swap point;
  migrate by surface, keep the app buildable after every pass.
- **`App.jsx` is ~8.7k lines, single file.** Every pass: `npm run build` + the browser preview DOM
  checks (screenshots are flaky in this env — verify via `read_page`/`javascript_tool`), plus backend
  suite green if any endpoint is added.
- **Dark theme:** every new token gets a dark variant; verify both.
- **Accessibility:** icons that are the only label get `aria-label`; keep `:focus-visible`; honour
  reduced motion.
- **Reversibility:** Phase 0–2 are CSS/markup only. Only Phase 3 touches schema/endpoints.

---

## 10. Open decisions for owner
1. **Icon set:** add the `lucide-react` dependency (fastest, standard) **or** keep zero-deps with a
   curated inline set (more control, slightly more upfront work)? *(Recommend: `lucide-react`.)*
2. **Hero visual:** static real product snapshot vs. a single illustrative image vs. copy-only hero?
3. **Scope of Phase 3** now vs. later — counts + rail are cheap; provider directory + tiered pricing are
   their own mini-batches.
4. Green-light Phase 0+1 to start? They're low-risk and unblock everything else.
