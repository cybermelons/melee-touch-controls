# melee-touch-controls

A character-specific touch gesture scheme for Melee on the web, as a runnable
demo. Open it on a phone and every gesture prints the exact controller state it
would emit.

Marth is the worked example. His kit is the hard case for touch: Dancing Blade
is a four-input branching chain, Dolphin Slash needs an angle, and his whole
neutral is spacing rather than buttons.

## Run it

```sh
npm install          # playwright, for the tests only
node serve.mjs       # http://localhost:8731
```

The demo itself is one static HTML file with no dependencies. `serve.mjs` only
exists so a phone on the same network can reach it. Open the page on a phone,
not a desktop: it is a touch scheme, and a mouse tells you very little about it.

## The seam

The demo is not wired to the engine. It prints the call it would make:

```
pc_touch_set_pad(B, 100, 0, 0, 0, 0, 0)  // buffered to earliest valid frame
```

In melee-pc, `src/pc/touch.h` exposes a thin PADStatus injector:

```c
void pc_touch_set_pad(uint16_t buttons, int8_t stickX, int8_t stickY,
    int8_t cstickX, int8_t cstickY, uint8_t triggerL, uint8_t triggerR);
```

A gesture layer only has to produce those seven values, so the scheme needs no
engine change. Printing the call rather than sending it keeps the demo
standalone and makes the mapping reviewable without a build.

## The scheme

### Left ring: movement

Drag to move. Two gestures are not raw analog:

- **Dash-dance** counts direction *reversals* past 0.6 of the gate, rather than
  reading a held value. A thumb on glass cannot hold a gate position reliably,
  so the reversal itself is the input.
- **Wavedash** is one down-back swipe that emits the whole jump into airdodge
  sequence, buffered.

### B pad: the blade chain

Dancing Blade is four sequential inputs with up, side and down branches, so it
is 1 + 3x3 on a controller. On glass that is four timed taps, which is the part
that does not survive the transition.

Here the finger never leaves the pad. Tap to start DB1, then swipe up, side or
down for each follow-up. The swipe direction picks the branch and the timing is
buffered to the earliest valid frame, so a four-hit chain is one continuous
stroke. Repeated plain taps give the no-branch version.

- **Dolphin Slash**: swipe up from rest. The swipe angle *is* the recovery
  angle, so the stick is not involved.
- **Shield Breaker**: hold from rest.

A hold only means Shield Breaker from rest. Holding through a live chain does
not cancel it.

### A pad and C ring

Tap, hold, or swipe up / down / side for jab, forward smash, up-air, down-air
and forward-air. The C ring aims smashes by angle.

### Assist tiers

Tiered so competitive play can keep tier 1 alone:

1. **auto L-cancel** — not a gesture at all.
2. **tipper assist** — a forward-air or forward-smash snaps spacing into the
   tipper band.
3. **DI buffer** — hold a direction during hitstun.

Toggle them in the demo and watch the emitted call change.

## Tests

```sh
npm test             # starts its own server, runs all four suites
npm run test:unit    # the one suite that needs no browser
```

| suite | what it protects |
|---|---|
| `t_dir8.mjs` | the direction classifier. Every gesture routes through it, so a bad threshold silently remaps the whole scheme. Diagonals must resolve to `side`, or a dash-dance flick fires an up-B. |
| `t_layout.mjs` | the overlay geometry at three viewports: pads clear the edges, no two pads overlap, no text or label sits on a pad. |
| `t_pads.mjs` | taps still register with double-tap zoom blocked, and no element is left `touch-action: auto`. |
| `t_chain.mjs` | the four-hit chain, its cap, its lapse, and the hold path. |

Set `CHROMIUM` to use a specific browser binary, and `DEMO_URL` to point the
browser suites at an already-running server.

Two of these exist because of bugs that shipped and were not visible by
reading the code:

- A double-tap suppressor added to block zoom ate the second tap of a Dancing
  Blade chain. Double-tapping a pad is a required input here.
- A pad label was moved three times, hitting a different neighbour each time,
  before the layout check could see the collision at all.

## Status

A demo, not an integration. It shows what the mapping feels like and what it
would emit. Unverified on real iOS Safari: the zoom block is confirmed only
under Chromium device emulation, and Safari ignores `maximum-scale` and
`user-scalable=no` in the viewport meta.
