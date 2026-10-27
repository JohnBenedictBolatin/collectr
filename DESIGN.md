# Collectr visual system

## World

**Gallery Ledger** brings the collector's calm inventory ritual into a personal display room. A sparse, orderly catalog carries the useful rigor; cabinet previews give each item a physical place. The library is a working inventory surface, not a storefront.

## Palette

Only these five authored interface colors may appear in UI surfaces, type, borders, or controls:

- Warm ivory `#F7F3E8`: page and card ground.
- Near-black `#20201E`: type, icons, outlines, and the restrained depth shadow.
- Teal `#78C5AA`: current navigation, shelf positions, and supporting selections.
- Orange `#EC781C`: one secondary accent and small active labels.
- Golden yellow `#F4A32A`: primary actions and selection emphasis.

Use ivory rather than white and near-black rather than gray. Keep body copy ink-on-ivory or ink-on-accent; pair colors with text or an icon. Item photography keeps its original color and never changes the interface token set.

## Typography and form

Use locally bundled Poppins Variable. Heavy, tightly composed headings are balanced with readable regular body copy. Controls and labels use medium weight. Use explicit dark outlines, 12–16px card corners, 8–12px control corners, and a restrained 3px offset shadow. Do not stack a border and shadow on the same card.

## Behavior and voice

The library sorts independently of shelf locations. A cabinet reads as a quiet, front-facing organizer with repeatable rows and slots. Teal indicates a current location, orange supports secondary emphasis, and golden yellow marks the main action. Messages use concise collector language and name how to recover from an error.

Cole is an original black-cat superhero. His transparent four-pose character sheet lives at `public/images/cole-character-sheet.png`. He appears only in onboarding, useful empty states, and brief celebrations, with an option to reduce appearances and system reduced-motion support.

## Approved surfaces

- Desktop Library: `.impeccable/mocks/desktop-library-approved.png` (selected by the user as “Catalog with shelf preview”).
- Desktop Shelves and mobile Library: see reference comps in `.impeccable/mocks/`.
- My Space desktop and mobile: `.impeccable/mocks/my-space-desktop-mockup.png` and `.impeccable/mocks/my-space-mobile-mockup.png`.

## My Space

Use a compact teal welcome panel led by “Welcome back, {name}.”, the product tagline, and one small Cole appearance in an ivory display nook with restrained orange and amber shapes. Keep the hero near 132px tall on desktop and 112px on mobile so the collection stays in the first viewport. At wide widths, align an ivory cabinet preview beside four recent additions, then show up to three named collections with accurate counts and separated photo strips.

The cabinet must read as a real display: a teal outer frame, ivory inset, two solid shelf boards with narrow orange fronts, square photo mounts, nameplates, and smaller open positions. Preserve the real slot order and show the first two rows. Match panel heading and footer alignment. Stack welcome, cabinet, recent additions, and collections on mobile; only the cabinet slot rail may scroll horizontally. Give section and primary navigation icons consistent ink outlines inside teal, orange, or amber badges. Keep the five approved colors, Poppins, and ink focus rings. Items without a personal photo use a neutral placeholder; only seeded demo items use sample photography.
