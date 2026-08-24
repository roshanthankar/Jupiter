# Jupiter — iOS app prototype (web)

A click-through iOS prototype that runs in the browser. Desktop shows the app inside an iPhone frame;
on a real phone it goes edge-to-edge (add to Home Screen for a near-native feel).

**Stack:** Vite · React 19 · TypeScript · Tailwind v4 · Framer Motion · Lucide icons

```bash
npm install
npm run dev      # http://localhost:5173 — also reachable on your LAN IP for phone testing
npm run build    # static site in dist/ → drop on Vercel / Netlify / GitHub Pages
```

## Project layout

```
src/
  App.tsx                 PhoneFrame → NavProvider → Navigator
  lib/nav.tsx             navigation stack: push / present (sheet) / presentModal / pop / popTo / reset
  lib/motion.ts           iOS easing + shared transitions
  components/
    PhoneFrame.tsx        device bezel, status bar, home indicator, safe-area CSS vars (--sat / --sab)
    Navigator.tsx         renders the stack with iOS transitions (push parallax, sheet, card modal, edge-swipe back)
    Screen.tsx            <Screen> + <Screen.Content> (scroll area) + <Screen.Footer> + <LargeTitle>
    NavBar.tsx            iOS nav bar (auto back button, Cancel in modals, large-title fade) + <BarButton>
    TabBar.tsx            iOS tab bar
    Button.tsx            filled / tinted / gray / plain / destructive
    List.tsx              <ListGroup> <ListRow> <TextField> <Toggle> <Badge> — inset-grouped lists
    Avatar.tsx
    SFSymbol.tsx          genuine SF Symbols as tintable masks (render new ones with scripts/sf-symbol.swift)
    Chat.tsx              assistant avatar, chat bubble, white option CTA
    SegmentedControl.tsx  iOS segmented control (UISegmentedControl metrics, animated thumb)
    CaseSidebar.tsx       prototype navigation: flows (segmented) → cases; shared by sidebar + mobile sheet
    FoldingStack.tsx      receipts that fold away as they scroll (see Folding receipts below)
  screens/
    registry.ts           ⟵ screen names + params (typed)
    index.ts              ⟵ name → component map
    LockScreen.tsx        iOS 26 Lock Screen (tap the notification to open the app) — wallpapers in public/wallpapers/ (official Apple images from macOS)
    Home.tsx              Home: top bar, profile, missed-EMI card
    EmiOptions.tsx        "See what I can do" — loan header + assistant options
```

## Adding a screen

1. `src/screens/registry.ts` — add `myScreen: undefined` or `myScreen: { id: string }`.
2. Create `src/screens/MyScreen.tsx`:
   ```tsx
   export function MyScreen({ params }: ScreenProps<'myScreen'>) {
     const nav = useNav()
     return (
       <Screen>
         <NavBar title="My screen" />
         <Screen.Content>…</Screen.Content>
       </Screen>
     )
   }
   ```
3. `src/screens/index.ts` — add `myScreen: MyScreen` to `SCREENS`.
4. Navigate: `nav.push('myScreen', { id })` · `nav.present('myScreen')` (sheet) · `nav.presentModal('myScreen')`.

## Navigation API (`useNav()`)

| call | effect |
|---|---|
| `push(name, params?)` | slide in from right, edge-swipe / Back / Esc to return |
| `present(name, params?)` | bottom sheet, drag grabber or tap backdrop to dismiss |
| `presentModal(name, params?)` | full-screen card, "Cancel" in nav bar |
| `pop()` / `dismiss()` | back one step |
| `popTo(name)` / `popToRoot()` | unwind several steps at once |
| `replace(name)` / `reset(name)` | swap top / swap the whole stack (cross-fade) |

Screens can read their own context with `useScreenEntry()` (index, presentation, inModal).

## Design tokens

Tailwind utilities map to iOS system colours & type: `bg-ios-blue`, `text-ios-label2`, `bg-ios-grouped`,
`text-body`, `text-headline`, `text-largetitle`, `rounded-ios`, `ease-ios`. See `src/index.css`.

## Motion (Apple HIG)

All motion comes from `src/lib/motion.ts` — one set of tokens modelled on UIKit's system transitions:

| token | use | value |
|---|---|---|
| `pushTransition` | navigation push/pop, parallax + dim | 0.35 s, UIKit curve `(0.32, 0.72, 0, 1)` |
| `sheetTransition` / `sheetDismissTransition` | sheets, card modals, Lock Screen unlock | spring 0.5 s / 0.4 s, bounce 0 |
| `fadeTransition` | stack reset/replace, **Reduce Motion fallback** | 0.25 s ease-in-out |
| `snapSpring` | settle after a released gesture | spring 0.35 s |
| `tapTransition` | pressed state on every control | 0.1 s |
| `toggleSpring`, `notificationSpring` | switch knob, notification arrival | springs |

Interactive pop completes past 50 % of the width or a flick (> 300 pt/s). When the OS has **Reduce Motion**
on (`prefers-reduced-motion`), the Navigator, Lock Screen and notifications replace slides/scales with
cross-dissolves — use `useReducedMotion()` from `@/lib/motion` when adding new motion.

## Folding receipts

V1 is one card: the state the case selected, unchanged. V2 puts every state on the screen as paper,
and a receipt folds away as it reaches the top rather than sliding off.

Each card is sliced into three panels along the creases it marks with `data-crease` — the perforation
and the explanatory line — and the foot turns back first, then the body, until only the header stub
is left and that scrolls off. The angles come from scroll position rather than from an animation, so
scrolling back up unfolds through the same geometry.

Panels turn *away* from the reader and stop at 90°, where they are edge-on and invisible: no panel
can reach above its own crease or below the height the stack reserved, so nothing needs clipping in
that direction. The stack works out what a receipt still covers from the same perspective projection
the browser draws with, which is what keeps the next receipt exactly one `gap` below the folding one.

Nothing here touches layout while you scroll. Each receipt keeps its natural height and the stack
moves them with transforms, because the height a fold gives up is exactly the scroll it costs to
fold — so the page is the same length either way, and the browser never has to reflow a screen full
of masked, filtered paper mid-gesture. Positions are sampled on a frame loop rather than straight off
the scroll event, since iOS Safari delivers those in bursts while a flick is coasting and a fold that
only moves when one lands looks stepped.

Two details exist because the ticket is a masked shape with a drop-shadow emboss, and a shadow
follows the alpha:

- a `data-crease` value nudges its crease further down. The ticket uses it to put the fold just past
  the punched notches, so the circles stay whole on the stub instead of being cut in half;
- the last panel's clip is opened up by `EMBOSS_ROOM` at the bottom. Every other panel is cut through
  solid paper, but that one ends at the scalloped edge, and clipping flush with it sliced the shadow
  off in a straight line right under the scallops.

Under Reduce Motion the fold is skipped and the receipts simply stack and scroll.

## States & cases (prototype navigation)

The desktop frame has a **Cases** sidebar; each entry loads a preset into the shared store (`src/lib/loan.ts`)
and lands directly on that state with the prior conversation already in the thread. Its **Annotations**
toggle pins numbered notes to the screen and lists them beside the phone; on a real phone there is no
room for that column, so the list becomes a sheet over the foot of the screen that folds away to
reveal what a pin is pointing at.

Main path · Misunderstood (free text the assistant can't parse; second message auto-escalates) · Unknown outcome
(ambiguous save, retry locked) · Can't determine eligibility (check warns, hands off) · Check takes too long
(courtesy prompt after ~4 s) · Clean failure (retry; second failure hands off) · Already paid · Home after
reschedule / escalation / payment. The thread also has a composer — anything typed is treated as unparsed.
