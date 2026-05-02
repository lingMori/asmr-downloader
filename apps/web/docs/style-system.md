# ASMRoner Sonic Mission Control Style System

## Tokens

The app uses role-based tokens instead of decorative accent colors:

- `--chassis-*`: machine body, bevels, rivets, and physical panels.
- `--screen-*`: CRT void, phosphor grid, and embedded display areas.
- `--phosphor-*`: primary green signal text and readouts.
- `--telltale-*`: amber, red, and cyan status lamps.
- `--tape-pink`: ASMRoner brand tape-label ink, reserved for live playback and active signals.

Dark mode is the powered CRT state. Light mode is the physical beige plastic shell with dark unpowered screens.

## Surfaces

- `.deck-chassis`: outer machine enclosure.
- `.deck-bezel`: physical inset around a screen.
- `.deck-screen`: CRT/data display with scanlines, vignette, phosphor glow, and RGB edge shift.
- `.deck-plate`: control plate for inputs, nav rows, switches, and file rows.
- `.deck-decal`: tape-label sticker for short uppercase metadata.

Avoid nesting screen inside screen or chassis inside chassis unless a component is intentionally a separate module.

## Components

- Buttons use amber acrylic, gray plate, inline ghost, or red halt variants.
- Badges use `decal`, `live`, `signal`, `warn`, `halt`, or `mute`.
- Inputs and selects render as CLI bays with TX focus indication.
- Progress uses tape reels and a tape track; running tasks animate the reels.
- Empty states render as broadcast test patterns.
- Audio playback uses `AudioDeck`, with custom controls and canvas waveform.

## Anti-Patterns

Do not reintroduce glass panels, generic gradients, default browser audio controls, Lucide icons, or large rounded SaaS cards.
