# Can / I Eat This? — Design Language

Read this file before designing or implementing any user-facing interface. It is the permanent visual and interaction standard for the product. `AGENTS.md` remains authoritative for product scope, architecture, privacy, and engineering practice.

## Visual Philosophy

The experience should feel like a thoughtful consumer product: calm, editorial, restrained, and carefully composed.
It must never feel like:

- Generic SaaS
- An enterprise dashboard
- A clinical or hospital interface
- Sterile or alarmist
- Gamified or playful
- Template generated
- A common AI landing page
  Do not copy another company’s branding, layout, typography, colors, illustrations, symbols, or copy. Capture the quality and restraint of excellent consumer-product design without reproducing another identity.
  Use less interface when less will do. Every visual element must clarify hierarchy, support an action, communicate evidence, or create useful continuity.

## Emotional Design Goals

The product should feel:

- Calm
- Editorial
- Premium
- Human
- Warm
- Reassuring
- Intimate
- Slightly cinematic
  Its emotional promise is: **Careful, transparent guidance without false certainty.**
  Avoid should feel serious but not punitive. Need more information should feel useful and actionable, not like product failure. Safe should feel reassuring without implying certification.

## Color System

Use semantic tokens defined in one central location. Components must not introduce hardcoded visual colors.
Core direction:

- Canvas: warm near-black, never pure black
- Primary text: soft cream, never pure white
- Secondary text: warm gray
- Muted text: lower-emphasis warm neutral with accessible contrast
- Surfaces: subtly lighter than the canvas
- Borders: low-contrast translucent light tone
- Focus ring: clearly visible and harmonious
- Safe: muted sage green
- Safe with caution: muted warm amber
- Avoid: muted terracotta or restrained red
- Need more information: cool gray, muted violet, or soft blue-gray
  Verdicts must always use words and, where helpful, icons in addition to color.
  Avoid bright neon colors, saturated traffic-light colors, blue-and-white clinical palettes, purple AI gradients, pure black/white combinations, large glowing gradients, and excessive glass effects.
  Check translucent colors against their composed background, not as isolated token values. Target WCAG AA contrast.

## Typography

Use exactly two primary font families:

1. One expressive editorial serif for the product name, hero statements, major narrative moments, and verdict headings.
2. One highly legible modern sans-serif for body text, forms, controls, labels, and explanations.
   Instrument Serif and Geist are the preferred direction, subject to approval during project foundation.
   Typography should use:

- Large editorial statements where narrative importance warrants them
- Tight but readable display line-height
- Comfortable body line-height
- Short, readable line lengths
- Restrained font weights
- Minimal uppercase
- Clear hierarchy without dashboard-style label clutter
  Do not add a third primary font family. Avoid overly bold headings, tiny metadata, and generic dashboard typography.

## Layout

Design mobile first.

- Center the primary experience in a 390–430px content column.
- Use approximately 20–24px mobile gutters.
- Prevent horizontal overflow at 320px.
- Use dynamic viewport units with a sensible fallback.
- Respect safe-area insets.
- Keep primary actions reachable above browser chrome and keyboards.
- Preserve one continuous mobile interaction on desktop.
- Center the experience within a full-width atmospheric canvas.
- Use additional desktop negative space, not additional panels.
  Never use a fake phone frame, sidebar navigation, dense grid, analytics layout, or dashboard conversion on desktop.
  Prefer continuous vertical storytelling. Use cards only when they create meaningful grouping.

## Spacing

Use a centralized spacing scale, based on consistent small increments, rather than arbitrary component values.
Spacing should provide:

- Comfortable control interiors
- Clear separation between conceptual decisions
- Generous transitions between narrative sections
- Intentional empty space around major statements
- Consistent mobile gutters and action spacing
  Editorial moments may use larger vertical intervals than controls. Empty space is structural, not leftover space.
  Avoid dense layouts, compressed forms, excessive separators, and inconsistent one-off gaps.

## Surfaces

Surfaces should feel quiet and refined:

- Soft tonal separation from the canvas
- Thin, low-contrast borders
- Restrained shadows
- Moderate corner radius
- Comfortable internal spacing
- Blur only when it remains legible and performant
  Avoid large drop shadows, glossy glass, thick borders, excessive pills, and nested cards inside cards.
  A surface must have a product purpose. Do not wrap every section in a container by default.

## Components

Every new component must reuse existing:

- Typography tokens
- Color tokens
- Motion tokens
- Spacing tokens
- Border and radius tokens
  Extend an existing component when its responsibility genuinely matches. Do not introduce a new visual pattern to solve one screen.
  Components should have clear pressed, focused, disabled, selected, loading, and error states where applicable.
  Avoid meaningless decorative components, badges without purpose, feature pills, floating blobs, and generic “AI” treatments.
  The user-provided food image should remain the primary visual object during analysis and results.

## Density

- Every screen should feel breathable.
- If a section can fit comfortably without a card, do not wrap it in a card.
- Prefer whitespace over containers.
- Prefer typography over decoration.

## Buttons

Use one visually dominant primary action per state.
Primary buttons should:

- Be full-width on mobile where appropriate
- Meet minimum touch-target requirements
- Feel substantial but not bulky
- Use concise labels
- Provide immediate, subtle press feedback
- Avoid unnecessary icons
  Secondary actions should be visually quieter. Tertiary actions should be restrained text controls. Destructive styling is reserved for actions such as Clear All.
  Do not give every action equal emphasis or use pill-shaped buttons indiscriminately.

## Forms

Forms should feel lightweight and conversational.

- Use progressive disclosure.
- Present one conceptual decision at a time.
- Use native semantic controls.
- Provide explicit, persistent labels.
- Add short supporting explanations only when useful.
- Use large tap targets and visible selected states.
- Use calm, specific validation messages.
- Keep input text at least 16px to prevent iOS zoom.
  Avoid long clinical intake forms, medical jargon, dense two-column layouts, tiny checkboxes, excessive required fields, and placeholder-only labels.
  Use native image input with `accept="image/*"` and `capture="environment"` where appropriate. Do not design a custom live camera viewfinder without explicit approval.

## Result Presentation

Recommendation is the conclusion, not the headline.
The story begins with evidence, not the verdict.

The result is a continuous editorial narrative, not a dashboard or card grid. Preserve this exact order:

1. **What we saw**
2. **What we know**
3. **What we don’t know**
4. **Recommendation**

### What we saw

Show the identified food or leading candidate, relevant visible ingredients, label-supported details, preparation observations, and image-analysis confidence.

### What we know

Show evidence-supported facts relevant to the profile, confirmed conflicts or reassuring details, and evidence provenance.

### What we don’t know

Show hidden-ingredient uncertainty, unreadable labels, and unknown pasteurization, doneness, preparation, or sodium details. Offer clarification when one answer could change the verdict.

### Recommendation

Show the verdict, a short contextual interpretation, up to three prioritized reasons, confidence, one next action or safer alternative, and the supported-scope disclaimer.
Use a prominent serif verdict heading, plain-language status, a restrained accent color, and an optional supporting icon. Never make the result resemble an official certification badge.
Evidence must remain visible and understandable. For each important reason show:

- The fact considered
- Source: Visible in image, Readable on label, Conventional inference, or User provided
- Strength: Confirmed, Likely, Possible, or Unknown
- The affected profile restriction
- The rule outcome
  Evidence responsible for Avoid or Need more information must be immediately visible. Secondary evidence may be expandable.
  Never show raw prompts, chain-of-thought, internal model reasoning, verbose rule traces, “100% safe,” medical seals, success-check spectacles, warning stripes, sirens, dramatic red screens, or confetti.

## Imagery

The user’s food image is the visual focus. Treat it with care during preview, analysis, and result continuity.
Do not add generic stock photography, medical or hospital imagery, cartoon food characters, AI-brain imagery, random gradient orbs, or decorative 3D objects.
Decorative artwork, if approved, should be minimal, abstract, atmospheric, and purposeful. It must never compete with the food image or imply medical authority.

## Motion

Motion should improve continuity, hierarchy, or perceived responsiveness. Use Motion for React and shared tokens.
Starting timing ranges:

- Press feedback: 80–120ms
- Small UI changes: 140–180ms
- Step transitions: 220–300ms
- Bottom sheets: 260–340ms
- Result reveal: 300–450ms
  Prefer gentle opacity, small vertical movement, smooth deceleration, minimal bounce, and immediate feedback.
  Appropriate uses:
- Step transitions
- Image-preview continuity
- Staged analysis messages
- Bottom sheets
- Result reveal
- Subtle press feedback
  Avoid large scaling, excessive springs, continuous decorative animation, heavy blur animation, slow cinematic delays, or animating every text element. Motion must never block interaction or delay safety information.
  Respect `prefers-reduced-motion`. Remove nonessential spatial movement and stagger while retaining clear state changes.

### Analysis loading

Do not use a spinner as the primary experience. Use staged, truthful messages such as:

- Looking closely at the food
- Identifying relevant ingredients
- Checking preparation details
- Applying your dietary profile
- Preparing the recommendation
  Provide immediate acknowledgment, restrained message transitions, an honest longer-delay state, cancellation, retry, and a restrained live region.
  Never use fake percentages or imply access to internal model progress. Show a completed response immediately; do not wait for the message sequence. Under reduced motion, keep the experience mostly static.
- The loading experience should reduce perceived waiting, not increase anticipation.

## Copywriting

Copy should be calm, direct, human, concise, transparent, nonjudgmental, and reassuring without false certainty.
Prefer:

- “Here’s what we could confirm.”
- “We need one more detail.”
- “This may not be suitable for your selected profile.”
- “Ask whether the cheese is pasteurized.”
  Avoid:
- Alarmist commands such as “Danger!”
- Absolutes such as “perfectly safe” or “guaranteed”
- Medicalized language without a product need
- AI hype and promotional claims
- Long explanations when one clarification would reduce uncertainty
  Error messages should be concise, nontechnical, actionable, and preserve the user’s dignity.

## Writing Rules

Prefer:

- Short sentences.
- Concrete nouns.
- Active voice.
  Avoid:
- Marketing language.
- Technical jargon.
- Long paragraphs.
- Overexplaining.

## Accessibility

- Target WCAG AA contrast.
- Use semantic headings and landmarks.
- Use native fieldsets and legends for grouped choices.
- Provide explicit labels and linked help/error text.
- Maintain visible keyboard focus.
- Use minimum 44×44px touch targets.
- Communicate verdicts with text and icons, never color alone.
- Move focus to the result heading when analysis completes.
- Use restrained live-region announcements.
- Make clarification sheets keyboard accessible with explicit close controls.
- Prevent background scrolling and manage focus for modal surfaces.
- Do not depend on hover.
- Avoid autoplaying or blocking motion.
  Test increased text, reduced motion, keyboard navigation, screen readers, mobile safe areas, and narrow viewports.

## Mandatory Screen Approval

Before implementing any major screen, Codex must present:

1. Screen purpose
2. Content hierarchy
3. Mobile layout description
4. Typography usage
5. Primary and secondary actions
6. Animation behavior
7. Empty, loading, and error states
   Stop and wait for explicit design-direction approval. Approval for one screen does not approve another. Material changes to an approved layout, hierarchy, interaction, or visual direction require renewed approval.

## Screen Review Checklist

Before implementation, verify:

- Mobile first
- Clear hierarchy
- One dominant CTA
- Consistent spacing
- Existing typography
- Existing color tokens
- Existing motion tokens
- Empty state
- Loading state
- Error state
- Accessibility
- No dashboard appearance
- No copied visual identity
  Also confirm that the screen uses intentional negative space, remains usable at 320px, supports safe areas, communicates uncertainty plainly, and adds no decorative pattern without product purpose.

## Design Inspiration

The product should be inspired by the qualities of products such as:

- Apple Health
- Linear
- Sunspell
- Notion
- Arc Browser

Shared qualities include:

- Editorial typography
- Calm spacing
- Clear hierarchy
- Excellent restraint
- Smooth interaction

Do not reproduce any product's branding or layouts.

## Design Principles

Every interface should satisfy:

- Explain before concluding.
- Reveal progressively.
- Reduce cognitive load.
- Reward confidence.
- Make uncertainty visible.
- Prefer one excellent interaction over three average ones.
