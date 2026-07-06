# Motion doctrine

*The constitution for movement in alpha / theta. V1 built the motion system;
this is the short set of rules that keep future features from drifting. If a
new animation can't be justified against one of these, it probably shouldn't
ship.*

1. **Entrances play once.** Route and content reveals fire on first view of a
   route per session (`lib/firstView`), never again on re-render or on a live
   tick. A page you return to is already there — it doesn't re-perform. Use the
   `firstView` gate for any `initial`→`animate` that would otherwise replay.

2. **Interactions always spring.** Hovers, presses, active-pill slides, list
   re-sorts, toggles — anything the user directly causes — animate with a
   spring (or `--ease-signature` for non-physical fades), never a linear tween.
   Direct manipulation should feel physical.

3. **Live data flashes directionally.** A value that changes because the market
   moved flashes in the direction of the move — green up, rose down — scoped to
   the cell, then eases out (~600ms). A silent swap loses information; a
   non-directional flash is worse (a green pulse on a falling price). See the
   price-tick flashes on Overview.

4. **Atmosphere never loops faster than ~6s, and dies under reduced motion.**
   Ambient washes / glow blobs drift slowly or sit still; nothing in the
   background pulses at a rate that draws the eye. Every infinite loop — CSS or
   Framer — must stop for `prefers-reduced-motion` (the CSS `.animate-*` kills
   and `MotionConfig reducedMotion="user"` cover most; verify opacity loops
   too).

5. **Chart marks enter by their nature.** Lines *draw* (`pathLength`), bars and
   areas *rise* (height/scaleY from the baseline), arcs *sweep*
   (`strokeDashoffset`), cells *scale from their own center*. First paint should
   look like one hand drew the chart, not like elements teleporting in. Draw-ins
   use `--dur-draw`.

6. **One easing, one duration ladder.** Reach for the tokens, never a fresh
   curve: `--ease-signature` (`cubic-bezier(0.22,1,0.36,1)`) and
   `--dur-fast` / `--dur-base` / `--dur-slow` / `--dur-draw`. Consistency of
   timing is a large part of what reads as engineered rather than assembled.

7. **Theater is earned and single-use.** Conducted moments (the goal-completion
   shimmer, the first-import overture) fire on a real achievement exactly once,
   persisted. Anything that could play twice a day is chrome, not theater — cut
   it.

8. **Subtract over time.** When in doubt, less motion. A shipped animation that
   stops earning its attention is a candidate for removal, not another layer on
   top.
