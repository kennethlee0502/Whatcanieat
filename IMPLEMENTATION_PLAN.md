# Implementation Plan

This document is the project's approved implementation roadmap and the source of truth for task sequencing. Tasks must be completed in the order shown without redesigning, reordering, merging, splitting, or reinterpreting their approved scope.

Status markers:

- ✅ Completed
- 🚧 In Progress
- ⬜ Not Started

This document is the canonical implementation roadmap for the project.

When starting a new development session, read this document together with:

- AGENTS.md
- DESIGN.md
- TASK_TEMPLATE.md

Do not change task order or scope without explicit approval.

## ✅ Task 1 — Stabilize the initialized baseline

**Goal:** Establish a clean, reproducible starting point.

**Scope:**

- Review generated Next.js files and dependencies.
- Add one minimal test proving the standard test command works.
- Resolve or document the workspace-root warning without changing unrelated parent files.
- Confirm lint, strict TypeScript, test aliases, and production build behavior.
- Review current dependency-audit findings without applying unsafe forced changes.

**Not included:** Product UI, domain models, or business logic.

**Validation:** Development server returns HTTP 200; lint, typecheck, tests, and production build pass; Git state is clean.

**Dependencies:** Phase 3 initialization.

## ✅ Task 2 — Establish the shared design foundation

**Goal:** Replace framework-default styling with the approved visual system.

**Scope:**

- First present the mandatory seven-part proposal for the shared shell, typography, actions, motion, and global states.
- Stop for explicit design approval before implementation.
- Configure the approved serif and sans-serif.
- Define semantic color, spacing, radius, typography, surface, and motion tokens.
- Establish warm canvas, focus treatment, safe areas, dynamic viewport behavior, reduced motion, and the centered mobile content width.
- Remove unused starter visual assets and styles.

**Not included:** Landing content, profile UI, capture flow, or result presentation.

**Validation:** Lint, typecheck, build, 320px overflow check, WCAG AA spot check, focus visibility, reduced-motion inspection.

**Dependencies:** Task 1 and explicit design approval.

## ✅ Task 3 — Define the MVP domain and validation contracts

**Goal:** Establish the complete provider-neutral domain vocabulary without unnecessary file-per-model abstractions.

**Scope:**

- Group related profile contracts:
  - Pregnancy
  - Allergies
  - Diet preference
  - Measurements and BMI
  - `AnalysisProfileContext`
- Group extracted-food contracts:
  - Identity
  - Ingredient evidence
  - Preparation facts
  - Nutrition signals
  - Label evidence
  - Uncertainty
- Group evaluation contracts:
  - Rule and rule match
  - Verdict
  - Evaluation result
  - Confidence
  - Clarification questions, answers, and fact patches
- Define analysis request, response, stored-profile, and safe-error schemas.
- Make unknown and contradictory facts explicit.

**Not included:** UI, persistence adapter, rule behavior, or OpenAI calls.

**Validation:** Schema tests for valid, invalid, minimal, complete, unknown, contradictory, and malformed structures; exhaustive verdict typing; typecheck.

**Dependencies:** Task 1.

## ✅ Task 4 — Implement profile minimization and local measurements

**Goal:** Safely separate the complete local profile from transmitted analysis context.

**Scope:**

- Implement the allowlisted `UserProfile` to `AnalysisProfileContext` projection.
- Add local height and weight validation with explicit units.
- Calculate BMI locally only from complete valid measurements.
- Ensure measurements never affect evaluation data.
- Define behavior for profiles with no active restrictions.

**Not included:** Profile form, storage, networking, or verdict rules.

**Validation:**

- Unit and boundary tests for measurements and BMI.
- Tests proving height, weight, and BMI cannot appear in analysis context.
- Tests for conditional inclusion of supported restrictions.
- Typecheck.

**Dependencies:** Task 3.

## ✅ Task 5 — Implement application state and session storage

**Goal:** Establish the state and persistence foundation for the complete `/app` flow.

**Scope:**

- Define a discriminated reducer for restoring, welcome, profile, capture, preparing-image, preview, analyzing, result, clarification, and error states.
- Define valid transitions, cancellation, retry, stale-response rejection, and global clear.
- Add the narrow storage contract.
- Implement the versioned `sessionStorage` adapter.
- Restore profiles after mount without hydration mismatch.
- Handle corrupt, outdated, blocked, and unavailable storage.
- Store only validated `UserProfile` data.

**Not included:** Visible profile UI, images, analysis requests, or results.

**Validation:** Reducer transition tests; storage round trips; corruption, unavailable-storage, restoration, and clear tests; proof that images and results cannot be persisted.

**Dependencies:** Tasks 3–4.

## ✅ Task 6 — Implement the `/app` shell and welcome flow

**Goal:** Provide the first working product entry and connect it to application state.

**Scope:**

- Present the mandatory seven-part proposal for restoring, first-use welcome, returning-user entry, privacy disclosure, and initial navigation.
- Stop for explicit design approval before implementation.
- Add the `/app` route.
- Implement restoring and welcome states.
- Connect the shared shell to application state.
- Provide concise supported-scope and privacy language.
- Transition new users to profile creation and returning users toward capture.

**Not included:** Profile fields, image capture, analysis, or public landing page.

**Validation:** Component tests for restoration outcomes and navigation; keyboard and focus review; 320px layout; increased-text and reduced-motion checks.

**Dependencies:** Tasks 2 and 5, plus explicit design approval.

## ✅ Task 7 — Implement the dietary restriction profile

**Goal:** Collect all restriction attributes through a lightweight, accessible form.

**Scope:**

- Present the mandatory seven-part profile proposal.
- Stop for explicit design approval before implementation.
- Implement pregnancy and optional week.
- Implement high-blood-pressure status.
- Implement mutually exclusive none, vegetarian, and vegan options.
- Implement allergy add, edit, remove, optional severity, normalization, and duplicate prevention.
- Use progressive disclosure and semantic fieldsets.
- Keep severity from implying that confirmed exposure is acceptable.

**Not included:** Height, weight, BMI UI, food rules, or analysis.

**Validation:** Component tests for all controls, progressive disclosure, duplicates, validation, keyboard use, labels, errors, and mobile layout.

**Dependencies:** Tasks 3, 5–6, plus explicit design approval.

## ✅ Task 8 — Complete profile measurements, persistence, and editing

**Goal:** Produce a validated session profile that can be restored and edited.

**Scope:**

- Add optional height and weight fields with explicit units.
- Show locally calculated BMI with clear future-facing language.
- State that measurements do not affect current recommendations.
- Validate and save completed profiles.
- Restore and edit existing profiles.
- Preserve the last valid profile if editing is abandoned.
- Continue in memory when storage is unavailable.

**Not included:** BMI-based rules, analysis transmission, or capture.

**Validation:** Create, save, refresh, restore, edit, abandon, invalid-measurement, and storage-failure tests; confirm analysis-context exclusion remains intact.

**Dependencies:** Tasks 4–7.

## ✅ Task 9 — Implement image validation, preparation, and lifecycle

**Goal:** Prepare mobile food images safely and keep them entirely in memory.

**Scope:**

- Validate supported file types and source-size limits.
- Correct orientation where browser behavior requires it.
- Resize excessive dimensions.
- Compress below the approved request target.
- Create and revoke object URLs.
- Cancel stale preparation work.
- Handle replacement, removal, clear, and unmount.
- Avoid adding another image dependency unless browser APIs prove insufficient and approval is obtained.

**Not included:** Capture UI, upload endpoint, image storage, or custom camera.

**Validation:** Large, portrait, landscape, unsupported, invalid, canceled, replaced, removed, and unmounted image tests; output-size checks; non-persistence verification.

**Dependencies:** Task 5.

## ✅ Task 10 — Implement capture and preview

**Goal:** Let users take or select, prepare, review, replace, and confirm a food image.

**Scope:**

- Present the mandatory seven-part proposal for empty capture, camera/library actions, preparation, preview, errors, and confirmation.
- Stop for explicit design approval before implementation.
- Use native file input with approved `accept` and `capture` attributes.
- Connect capture, preparing-image, and preview states.
- Preserve profile state when camera use backgrounds the browser.
- Show actionable invalid, unsupported, oversized, and preparation errors.
- Require explicit confirmation before analysis.

**Not included:** API calls, analysis loading, or results.

**Validation:** Component tests for capture cancellation, preparation, preview, replacement, removal, focus, errors, safe areas, reduced motion, and 320px layout.

**Dependencies:** Tasks 6, 8–9, plus explicit design approval.

## ✅ Task 11 — Establish rule provenance and normalization

**Goal:** Create the safety foundation every deterministic rule must use.

**Scope:**

- Define the required provenance record:
  - Source
  - Relevant guidance or threshold
  - Stable source reference
  - Date reviewed
  - Rule version
  - Assumptions
  - Scope limitations
- Require complete provenance for every safety rule.
- Implement canonical normalization for ingredients, allergens, preparation, and nutrition signals.
- Preserve original labels, evidence source, evidence strength, contradictions, and unknowns.
- Ensure normalization cannot increase certainty.
- Make normalization idempotent.

**Not included:** Category-specific safety thresholds or final verdict aggregation.

**Validation:** Provenance-completeness tests; alias, contradiction, unknown-preservation, source-preservation, and idempotence tests.

**Dependencies:** Task 3.

## ✅ Task 12 — Research and implement allergy rules

**Goal:** Deterministically evaluate allergy evidence using reviewed authoritative guidance.

**Scope:**

- Review authoritative allergy sources before writing rule code.
- Record guidance, review date, version, assumptions, and limitations.
- Define confirmed, likely, possible, absent, and unknown ingredient behavior.
- Encode the approved rule cases.
- Ensure confirmed relevant allergens always produce Avoid.
- Ensure allergy severity never downgrades a confirmed match.
- Generate structured evidence and appropriate clarification candidates.

**Not included:** New allergy categories outside the approved profile vocabulary or emergency guidance.

**Validation:** Source review checkpoint before coding; provenance tests; confirmed, likely, possible, unknown, absent, severity, and hidden-ingredient fixtures.

**Dependencies:** Task 11.

## ✅ Task 13 — Research and implement pregnancy rules

**Goal:** Evaluate only reviewed, MVP-relevant pregnancy food guidance.

**Scope:**

- Review authoritative pregnancy food-safety sources before writing rule code.
- Record exact guidance or thresholds, review date, version, assumptions, and limitations.
- Implement approved pasteurization, raw/undercooked animal-product, and food-category rules.
- Produce Need more information when preparation facts could conceal an avoid-level risk.
- Use pregnancy week only if authoritative reviewed guidance establishes an MVP-relevant distinction.

**Not included:** General prenatal advice, diagnosis, or invented week-specific behavior.

**Validation:** Source approval checkpoint; provenance tests; confirmed-risk, uncertain-preparation, cleared, and boundary fixtures.

**Dependencies:** Task 11.

## ✅ Task 14 — Research and implement high-blood-pressure rules

**Goal:** Produce narrow sodium-related caution using reviewed authoritative guidance.

**Scope:**

- Review authoritative sodium guidance before writing rule code.
- Record applicable thresholds, serving assumptions, review date, version, and limitations.
- Prefer readable label evidence.
- Treat coarse image-derived nutrition signals conservatively.
- Produce Safe with caution rather than unsupported Avoid behavior.
- Avoid expanding into general nutrition tracking.

**Not included:** Calorie tracking, broad cardiovascular recommendations, or invented sodium thresholds.

**Validation:** Source approval checkpoint; provenance tests; readable-label, serving-size, coarse-signal, unknown, and below-threshold fixtures.

**Dependencies:** Task 11.

## ✅ Task 15 — Specify and implement vegetarian and vegan rules

**Goal:** Deterministically identify supported diet-preference conflicts.

**Scope:**

- Review and approve the product-policy basis before writing rule code.
- Document canonical animal-derived ingredient categories, assumptions, limitations, date, and version.
- Distinguish vegetarian and vegan conflicts.
- Separate confirmed evidence from conventional recipe inference.
- Preserve uncertainty when ingredients cannot be established.
- Produce structured evidence and clarification candidates.

**Not included:** Religious diets, ethical scoring, environmental claims, or additional dietary systems.

**Validation:** Policy approval checkpoint; confirmed, inferred, unknown, vegetarian-only, vegan-only, and overlapping restriction fixtures.

**Dependencies:** Task 11.

## ✅ Task 16 — Implement aggregation, confidence, and the complete rule engine

**Goal:** Combine all supported rules into one deterministic evaluation entry point.

**Scope:**

- Evaluate every applicable rule independently.
- Aggregate using Avoid, Need more information, Safe with caution, then Safe.
- Derive confidence separately from severity.
- Require stronger evidence for Safe than Avoid.
- Prioritize up to three reasons.
- Select consequential unknowns, clarification questions, and one next action.
- Register and version the complete approved rule set.
- Preserve provenance references in every result.

**Not included:** UI, API, OpenAI, or additional medical rules.

**Validation:** Complete verdict-priority matrix, multi-restriction cases, confidence combinations, reason cap, determinism, repeated evaluation, provenance completeness, and infrastructure-independence tests.

**Dependencies:** Tasks 12–15.

## ✅ Task 17 — Implement mock analysis and premium loading

**Goal:** Exercise the complete client flow without provider integration.

**Scope:**

- Present the mandatory seven-part proposal for analyzing, delay, cancellation, retry, and failure states.
- Stop for explicit design approval before implementation.
- Add isolated synthetic responses for all four verdicts.
- Connect preview to analyzing, result, cancel, error, and retry states.
- Implement staged truthful messages without a spinner or fake progress.
- Show completed results immediately.
- Provide static reduced-motion behavior and accessible announcements.

**Not included:** OpenAI, API route, or final result presentation.

**Validation:** State and component tests for success, slow response, cancellation, retry, stale response, error recovery, immediate completion, and reduced motion.

**Dependencies:** Tasks 10 and 16, plus explicit design approval.

## ✅ Task 18 — Implement the result narrative and evidence presentation

**Goal:** Present every verdict through the approved evidence-first editorial story.

**Scope:**

- Present the mandatory seven-part proposal for all four results.
- Stop for explicit design approval before implementation.
- Implement the exact order:
  1. What we saw
  2. What we know
  3. What we don’t know
  4. Recommendation
- Show evidence fact, source, strength, affected restriction, and outcome.
- Keep Avoid and Need more information evidence immediately visible.
- Show confidence, up to three reasons, scope limitation, and one next action.
- Move focus to the result heading.

**Not included:** Real API, clarification interaction, history, or sharing.

**Validation:** All verdict fixtures; evidence visibility; reason cap; color-independent meaning; focus, keyboard, increased-text, reduced-motion, and 320px checks.

**Dependencies:** Tasks 16–17, plus explicit design approval.

## ✅ Task 19 — Define the OpenAI extraction contract

**Goal:** Establish a strict server-owned image-to-facts contract.

**Scope:**

- Define the versioned structured-output schema.
- Define prompt ownership and prompt versioning.
- Require food facts, evidence, uncertainty, and explicit unknowns.
- Prohibit verdicts and personalized medical guidance.
- Treat visible text as untrusted data.
- Ensure only minimized profile context can be supplied.
- Add valid, malformed, contradictory, and prompt-injection fixtures.

**Not included:** SDK call, route handler, client request, or live provider test.

**Validation:** Schema fixture tests; rejection of verdict-bearing, malformed, excessive, or contradictory output where unsafe.

**Dependencies:** Tasks 3–4 and 11.

## ✅ Task 20 — Implement the server-only provider adapter

**Goal:** Translate the provider-neutral extraction contract into an OpenAI image request.

**Scope:**

- Keep the SDK, API key, prompt, and provider types server-only.
- Assemble the versioned extraction prompt.
- Format image input and minimized context.
- Request structured output.
- Parse and validate the response.
- Classify timeout, unavailable, rejected, and malformed responses.
- Support mocking without paid calls.

**Not included:** Rule evaluation inside the adapter, API route, or client integration.

**Validation:** Mocked adapter tests, prompt-injection fixtures, timeout/error mapping, schema failures, and server-only import verification.

**Dependencies:** Task 19.

## ✅ Task 21 — Implement the analysis endpoint and deterministic pipeline

**Goal:** Provide one secure route from validated upload to deterministic response.

**Scope:**

- Validate content type, image type, payload size, and `AnalysisProfileContext`.
- Reject forbidden and additional profile fields.
- Call the provider adapter.
- Validate extraction.
- Normalize facts.
- Run the versioned rule engine.
- Validate the response.
- Add timeout, non-caching behavior, request-scoped cleanup, and stable redacted errors.
- Avoid sensitive logging.

**Not included:** Client fetch, streaming, rate-limit service, persistence, or another provider.

**Validation:** Route integration tests for success, invalid request, oversized image, prohibited fields, timeout, unavailable provider, malformed extraction, prompt injection, no-cache behavior, and redacted errors.

**Dependencies:** Tasks 16 and 19–20.

## ✅ Task 22 — Integrate real client analysis

**Goal:** Replace mock submission with the validated server pipeline.

**Scope:**

- Submit the prepared image and allowlisted profile context.
- Support abort and request identity.
- Map stable server errors to application error states.
- Preserve profile and image for retry.
- Ignore stale responses.
- Keep mock responses available only to tests or explicit development fixtures.
- Verify the transmitted profile payload contains no measurements.

**Not included:** Clarification, scan history, streaming, or analytics.

**Validation:** Mock-service component tests, cancellation, retry, stale response, prohibited-field assertion, error mapping, and local end-to-end smoke test.

**Dependencies:** Tasks 17–18 and 21.

## ⬜ Task 23 — Implement deterministic clarification

**Goal:** Resolve one consequential unknown without conversational medical chat or another model call.

**Scope:**

- Present the mandatory seven-part proposal for the clarification interaction.
- Stop for explicit design approval before implementation.
- Select the highest-impact answerable question.
- Render constrained answer controls.
- Map valid answers to predefined fact patches.
- Record user-provided provenance.
- Preserve original evidence.
- Reevaluate every rule with the same rule-set version.
- Return to the revised result with accessible focus and announcement behavior.

**Not included:** Free-form chat, arbitrary questions, persistence, or second provider call.

**Validation:** Valid and invalid answers, cancel, keyboard/dialog behavior, immutable evidence, provenance, all-rule reevaluation, verdict changes in both directions, repeat determinism, and reduced motion.

**Dependencies:** Tasks 16, 18, and 22, plus explicit design approval.

## ⬜ Task 24 — Complete Clear All and privacy-safe lifecycle behavior

**Goal:** Ensure every temporary datum can be removed reliably.

**Scope:**

- Add the visible Clear All action with appropriate confirmation.
- Abort active requests.
- Cancel pending image work.
- Revoke object URLs.
- Clear stored profile.
- Remove drafts, image, facts, result, clarification, and errors from memory.
- Return to welcome.
- Verify images, facts, and results are never written to storage.

**Not included:** Server deletion because the MVP has no server persistence.

**Validation:** Clear from profile, preview, analyzing, result, clarification, and error states; session-storage inspection; object-URL and active-request cleanup tests.

**Dependencies:** Tasks 5, 9, and 22–23.

## ⬜ Task 25 — Implement the public landing page

**Goal:** Replace the framework starter with a concise, trustworthy product introduction.

**Scope:**

- Present the mandatory seven-part landing-page proposal.
- Stop for explicit design approval before implementation.
- Explain product purpose, supported scope, uncertainty posture, and decision-support limitation.
- Provide one dominant entry into `/app`.
- Link to privacy and build information.
- Set accurate metadata.
- Remove unused starter assets and template links.

**Not included:** Generic feature grids, testimonials, authentication, analytics, or stock imagery.

**Validation:** Responsive and keyboard review; concise-copy audit; metadata; no external starter links; lint, typecheck, and build.

**Dependencies:** Task 2 and explicit design approval.

## ⬜ Task 26 — Implement privacy and build pages

**Goal:** Explain data handling, architecture, evidence, and limitations accurately.

**Scope:**

- Present the required seven-part proposals for `/privacy` and `/build`; they may be reviewed together but require explicit approval before implementation.
- `/privacy` explains:
  - What stays in session storage
  - What remains only in memory
  - What is transmitted
  - AI-provider processing
  - Clear All
  - No account, database, or history
  - Non-HIPAA and decision-support limitations
- `/build` explains:
  - Hypothesis
  - AI extraction versus deterministic verdict ownership
  - Profile minimization
  - Evidence and uncertainty
  - Rule provenance
  - Trade-offs, limitations, and future possibilities
- Keep both pages static and concise.

**Not included:** Legal-policy expansion, internal prompts, model reasoning, system metrics, or unsupported future commitments.

**Validation:** Content audit against actual behavior; privacy/data-flow accuracy; architecture review; accessibility; responsive layout; production build.

**Dependencies:** Tasks 21, 24–25, plus explicit design approval.

## ⬜ Task 27 — Cross-layer hardening, mobile QA, and deployment verification

**Goal:** Verify that the complete MVP is safe, accessible, production-ready, and faithful to its claims.

**Scope:**

- Add the remaining high-value cross-layer regression fixtures.
- Verify all verdict priorities and multiple simultaneous restrictions.
- Prove height, weight, and BMI exclusion at the route boundary.
- Verify clarification parity with initial evaluation.
- Audit rule provenance completeness and review dates.
- Audit semantic structure, focus, live regions, dialogs, contrast, increased text, reduced motion, and color-independent verdicts.
- Test 320px, primary mobile widths, and desktop centering.
- Test iPhone Safari and Android Chrome.
- Test camera cancellation, browser backgrounding, large images, orientation, slow networks, timeouts, cancellation, and retry.
- Review dependency audit findings and apply only safe upgrades.
- Verify environment-secret handling, non-caching, redacted errors, and absence of sensitive application logging.
- Deploy a Vercel preview and smoke-test all routes and representative verdicts.
- Run final lint, typecheck, tests, and production build.

**Not included:** New features, broad visual redesign, authentication, database, analytics, custom domain, or speculative refactoring.

**Validation:**

- Full automated suite passes without paid API dependency.
- Lint and typecheck pass.
- Production build passes.
- All four verdict scenarios pass.
- Rule-provenance audit passes.
- Privacy/data-flow audit passes.
- Mobile and accessibility QA have no unresolved release blockers.
- Vercel preview passes route, analysis, error, and secret-handling checks.
- Git working state and known limitations are documented.

**Dependencies:** Tasks 22–26.
