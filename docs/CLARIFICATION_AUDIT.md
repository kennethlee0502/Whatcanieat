# Executive Summary

This audit identifies eight distinct clarification paths in the current repository. Seven have genuine decision value because at least one realistic answer can produce a different deterministic recommendation. One path—the high-blood-pressure sodium question—also changes the final recommendation, but in a counterintuitive way: “high” can produce Safe with Caution, while “not high” can still produce Need More Information because the answer does not satisfy the engine’s reliable serving-based sodium adequacy requirement.

No clarification is returned when the final verdict is Avoid. Confirmed allergen, pregnancy preparation, or diet-conflict evidence therefore suppresses all questions at aggregation time, including questions produced by other rule evaluations. The current implementation already prevents the most direct form of asking after a decisive Avoid result.

The principal audit concern is not a large set of purely descriptive questions. It is the absence of an explicit decision-value check at selection time. Rule modules decide whether a question can be offered, then the engine returns the first eligible uncertain match according to deterministic rule sorting. The engine does not compare the possible answer outcomes, establish which question has the greatest decision value, or verify that a non-Avoid recommendation remains undecided because of that exact question.

Additional concerns are uneven answer semantics and fact association. Pregnancy questions use fixed preparation fact identifiers, while some triggering uncertainties may use different associations. An answer can resolve the local rule without removing the original consequential uncertainty from global adequacy. The orphan diet-uncertainty path has the same issue: an “absent” answer creates a cleared ingredient fact but does not explicitly resolve the original unassociated uncertainty. These paths still have decision value because a confirmed conflict produces Avoid, but their clearing answers may not produce the resolution a user would expect.

# Audit Scope

The audit covers:

- clarification question construction in allergy, pregnancy, high-blood-pressure, vegetarian, and vegan rules;
- the triggers that attach questions to uncertain rule evaluations;
- rule sorting, verdict priority, global Safe adequacy, and clarification selection;
- constrained fact patches and full deterministic reevaluation after an answer;
- uncertainty removal through explicit fact associations;
- result and clarification presentation;
- extraction uncertainty and contradiction contracts;
- rule provenance and current clarification-related tests.

The audit evaluates current behavior only. It does not change or redesign rules, aggregation, prompts, schemas, application state, presentation, or tests. Recommendations are conceptual inputs for later product review.

# Audit Methodology

Each rule path capable of constructing a clarification question was traced from normalized facts through its local rule evaluation, engine collection, verdict aggregation, selection, constrained answer patch, uncertainty handling, and full `evaluateFood` reevaluation.

“Resulting deterministic recommendation” below describes the isolated path with otherwise adequate evidence. In a combined profile, another higher-priority rule may control the final recommendation. “Clear” means the local rule becomes cleared or non-contributing; a global Safe result still requires confirmed identity, high extraction confidence, absence of consequential uncertainty and contradictions, and restriction-specific adequacy.

Decision value is assessed against the approved principle: different plausible answers must be capable of producing different deterministic recommendations. User answerability is assessed for a normal user who may have a label, packaging, or access to the preparer, not for a clinician or food-safety expert.

# Repository-wide Findings

1. **Total clarification paths:** 8.
2. **Clarifications with genuine decision value:** 7 clearly compliant paths and 1 path with conditional/counterintuitive value.
3. **Clarifications existing only for descriptive completeness:** None conclusively identified among questions that can reach the UI.
4. **Clarifications unable to change the recommendation:** None in every circumstance. The high-blood-pressure “not high” answer does not produce the expected clearance, and clearing answers in some unassociated-uncertainty paths may leave Need More Information.
5. **Clarifications users may struggle to answer:** All eight are at least context-dependent. Ingredient and preparation questions require a complete label or reliable preparer knowledge; pasteurization requires packaging or supplier information; the sodium question assumes the label describes the serving as “high.”
6. **Duplicate clarification logic:** Allergy and diet rules independently implement the same present/absent/unknown ingredient patch pattern. Pregnancy animal and sprout/dough paths reuse the same doneness question. Animal doneness and raw-animal-status questions overlap conceptually but target different existing facts.
7. **Clarifications after decisive evidence:** None after a final Avoid verdict; the engine explicitly returns no questions for Avoid. A question may accompany Need More Information even when another restriction already supports Safe with Caution, because Need More Information has higher priority and the unresolved fact may still lead to Avoid.
8. **Rules over-prioritizing Need More Information:** The global Safe adequacy fallback can preserve Need More Information after a locally clearing answer when a consequential uncertainty remains unassociated. Diet and pregnancy are exposed to this mismatch. The high-blood-pressure path also falls back to Need More Information after “not high” because a user-provided coarse moderate value is neither a triggered nor a cleared serving-based result.
9. **Repeated philosophy conflicts:** Question selection is first-eligible rather than proven highest-value; fixed or incomplete fact associations can prevent a clearing answer from resolving global uncertainty; presentation does not distinguish verdict-changing from non-verdict-changing unknowns.
10. **Cross-restriction inconsistency:** Allergy questions carry the actual presence-gap identifiers into `relatedFactIds`. Diet questions usually carry only an ingredient identifier, and pregnancy questions carry fixed preparation identifiers. High blood pressure carries the collected gap identifiers. This makes uncertainty removal more reliable for allergy and high blood pressure than for some pregnancy and diet cases.

# Complete Clarification Audit Table

| Path | Restriction | Question | Decision change? | Decision value | Typical user can answer? | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Allergy | Confirm selected allergen presence | YES | High | MAYBE | Keep |
| 2 | Pregnancy | Confirm pasteurization | YES | High | MAYBE | Keep |
| 3 | Pregnancy | Confirm animal-product doneness | YES | High | MAYBE | Keep |
| 4 | Pregnancy | Confirm raw animal product | YES | High | MAYBE | Keep |
| 5 | Pregnancy | Confirm sprout/dough doneness | YES | High | MAYBE | Keep |
| 6 | High blood pressure | Confirm whether label describes high sodium | YES, but asymmetrically | Medium | MAYBE | Rewrite |
| 7 | Vegetarian or vegan | Confirm represented ingredient presence | YES | High | MAYBE | Keep |
| 8 | Vegetarian or vegan | Confirm orphan mapped ingredient uncertainty | YES, but clearing is incomplete | Medium | MAYBE | Needs Product Decision |

## Path 1 — Selected-allergen ingredient presence

**Restriction:** Food allergy.

**Current deterministic rule(s):** `allergy-ingredient-uncertain`, followed after an answer by the confirmed-allergen, explicitly-absent, or uncertain-allergen rule.

**Current clarification question:** “Can the ingredient list or person who prepared it confirm whether this food contains [allergen]?”

**Current trigger:** A selected allergen has one or more unresolved presence gaps, no independent cross-contact or contradiction risk, no reliable absence covering the gap, and no prior unknown user answer.

**Why this clarification exists today:** Presence would produce Avoid; reliable absence can clear the local ingredient concern.

**Possible user answers:**

- **Confirmed present:** The ingredient becomes confirmed with user-provided evidence. The allergy rule returns Avoid.
- **Confirmed absent:** The ingredient becomes absent with user-provided evidence. Explicitly associated uncertainties are removed, and the allergy rule clears if no independent risk remains. The final result may be Safe when global adequacy is otherwise satisfied.
- **Still unknown:** The ingredient remains unknown, the uncertainty remains, and the result remains Need More Information. The rule suppresses another identical question.

**Can different answers change the deterministic recommendation? YES.** Confirmed presence produces Avoid, while confirmed absence can clear the concern.

**Decision Value: High.** The answer distinguishes an avoid-level conflict from a possible clearance.

**Typical User Can Answer? MAYBE.** A complete label or reliable preparer can answer; a user viewing an unlabelled mixed dish often cannot.

**Recommendation: Keep.** Its options have clear rule effects and the question is withheld when independent unresolved risk would make the answer insufficient.

**Decision Philosophy Compliance:** Generally compliant. It targets an active allergy and has direct verdict value. It may still leave global incompleteness outside the selected allergen, which is separate from the question itself.

## Path 2 — Pasteurization status

**Restriction:** Pregnancy.

**Current deterministic rule(s):** `pregnancy-pasteurization-unknown`, `pregnancy-unpasteurized-product`, and the local pregnancy preparation clearance rule.

**Current clarification question:** “Is this product pasteurized?”

**Current trigger:** A pasteurization-sensitive category is confirmed or consequentially uncertain; pasteurization is unresolved or lacks reliable evidence; no independent contradiction remains; and the user has not already answered that pasteurization is unknown.

**Why this clarification exists today:** The reviewed rule treats reliably supported unpasteurized status as Avoid and supported pasteurized status as locally cleared.

**Possible user answers:**

- **Pasteurized:** Adds confirmed user evidence and locally clears the pasteurization concern. The final recommendation may be Safe if all other pregnancy dimensions and global adequacy are complete.
- **Unpasteurized:** Adds confirmed user evidence and produces Avoid when the applicable category is confirmed.
- **Unknown:** Preserves the unresolved state and Need More Information, without repeating the question.

**Can different answers change the deterministic recommendation? YES.** Pasteurized and unpasteurized answers lead to different local rules and can lead to Safe versus Avoid.

**Decision Value: High.** It resolves a fact capable of changing the result to Avoid.

**Typical User Can Answer? MAYBE.** Packaging or a supplier may state pasteurization; it is not reliably knowable from appearance.

**Recommendation: Keep.** The question is specific, constrained, and tied to an existing reviewed rule.

**Decision Philosophy Compliance:** The question itself complies. Some triggering uncertainty records may not be explicitly associated with the question’s fixed `preparation-pasteurization` fact identifier. In those cases a pasteurized answer may clear the local rule while global adequacy still sees consequential uncertainty, creating an outcome that is not fully aligned with the expected decision value.

## Path 3 — Animal-product doneness

**Restriction:** Pregnancy.

**Current deterministic rule(s):** `pregnancy-animal-preparation-unknown`, `pregnancy-undercooked-animal-product`, `pregnancy-raw-animal-product`, and local preparation clearance.

**Current clarification question:** “Is this food fully cooked?”

**Current trigger:** A supported animal category is present or consequentially uncertain, preparation is unresolved, the unresolved facts require a doneness answer rather than only raw-animal-product status, no independent contradiction remains, and no prior unknown doneness answer exists.

**Why this clarification exists today:** Supported fully cooked evidence can clear the local concern; raw or undercooked evidence can produce Avoid.

**Possible user answers:**

- **Fully cooked:** Adds confirmed user evidence and can clear the animal-preparation concern.
- **Raw or undercooked:** Adds confirmed user evidence and produces Avoid for a confirmed applicable animal category.
- **Unknown:** Leaves the concern unresolved as Need More Information and suppresses a repeated question.

**Can different answers change the deterministic recommendation? YES.**

**Decision Value: High.** The answer separates a locally cleared preparation state from an avoid-level state.

**Typical User Can Answer? MAYBE.** A person who prepared or cut into the food may know; appearance alone is insufficient.

**Recommendation: Keep.** It is actionable and has direct verdict value.

**Decision Philosophy Compliance:** Substantively compliant. As with pasteurization, a consequential uncertainty lacking the fixed doneness association can survive a clearing answer and continue to block global adequacy.

## Path 4 — Raw animal product

**Restriction:** Pregnancy.

**Current deterministic rule(s):** `pregnancy-animal-preparation-unknown`, `pregnancy-raw-animal-product`, and local preparation clearance.

**Current clarification question:** “Does this contain a raw animal product?”

**Current trigger:** A supported animal category is present or consequentially uncertain, raw-animal-product status is the unresolved preparation dimension while doneness itself is not unresolved, no independent contradiction remains, and no prior unknown raw-animal answer exists.

**Why this clarification exists today:** Confirmed raw-animal presence produces Avoid; confirmed absence can clear the scoped preparation concern.

**Possible user answers:**

- **Yes:** Produces confirmed user evidence and Avoid for a confirmed applicable category.
- **No:** Produces confirmed user evidence and can clear the local concern.
- **Unknown:** Preserves Need More Information and prevents repetition.

**Can different answers change the deterministic recommendation? YES.**

**Decision Value: High.** It directly distinguishes Avoid from a possible clearance.

**Typical User Can Answer? MAYBE.** The preparer may know; a normal user cannot reliably infer it from the image.

**Recommendation: Keep.** It targets the exact existing fact used by the rule.

**Decision Philosophy Compliance:** Generally compliant, subject to the same explicit-association limitation for residual consequential uncertainty.

## Path 5 — Sprout, dough, or batter doneness

**Restriction:** Pregnancy.

**Current deterministic rule(s):** `pregnancy-sprout-or-dough-preparation-unknown`, `pregnancy-raw-sprout-or-dough`, and local preparation clearance.

**Current clarification question:** “Is this food fully cooked?”

**Current trigger:** A supported sprout, dough, or batter category is present or consequentially uncertain; doneness is unresolved; no independent contradiction remains; and no prior unknown doneness answer exists.

**Why this clarification exists today:** Fully cooked evidence can clear the local preparation concern; raw or undercooked evidence can produce Avoid.

**Possible user answers:**

- **Fully cooked:** Can locally clear the concern.
- **Raw or undercooked:** Produces Avoid for a confirmed applicable category.
- **Unknown:** Preserves Need More Information and suppresses repetition.

**Can different answers change the deterministic recommendation? YES.**

**Decision Value: High.** The alternatives map to materially different rule outcomes.

**Typical User Can Answer? MAYBE.** The preparer may know, but a composite food can make the component-specific answer difficult.

**Recommendation: Keep.** The question has direct verdict value.

**Decision Philosophy Compliance:** The rule-specific intent complies. The generic wording “this food” may be broader than the applicable component, and unassociated uncertainty can remain after a clearing answer. These are audit findings, not implementation proposals.

## Path 6 — High-sodium label classification

**Restriction:** High blood pressure.

**Current deterministic rule(s):** `high-blood-pressure-sodium-uncertain`, `high-blood-pressure-coarse-high-sodium`, the exact-label threshold rule, and the non-applicable sodium rule.

**Current clarification question:** “Does the nutrition label describe this serving as high in sodium?”

**Current trigger:** A consequential sodium or Nutrition Facts uncertainty is user-resolvable, no sodium contradiction exists, and no prior unknown sodium answer exists.

**Why this clarification exists today:** An affirmative coarse high-sodium signal supports Safe with Caution.

**Possible user answers:**

- **High:** Sets a user-provided coarse high value. The coarse high-sodium rule produces Safe with Caution.
- **Not high:** Sets the coarse value to moderate. It does not provide a confirmed numeric serving value and therefore reaches the non-applicable local rule. Global high-blood-pressure adequacy is not satisfied, so the final result remains Need More Information.
- **Unknown:** Leaves the consequential gap unresolved. The local uncertain rule recommends Safe with Caution, but global adequacy changes the final result to Need More Information and suppresses repetition.

**Can different answers change the deterministic recommendation? YES.** “High” can produce Safe with Caution, while the other options remain Need More Information. The distinction is real but asymmetric.

**Decision Value: Medium.** It can replace uncertainty with a caution, but the negative answer does not establish the supported clearance that ordinary wording may imply.

**Typical User Can Answer? MAYBE.** A label may provide milligrams and Daily Value without literally describing the serving as “high.” A typical user may not know how to translate the label.

**Recommendation: Rewrite.** Product review should align the question and answer meanings with the evidence the existing rule can actually use. This audit does not prescribe replacement wording or rule behavior.

**Decision Philosophy Compliance:** Partial. The affirmative answer has decision value. The negative answer cannot resolve the decision, making one plausible branch less actionable than the question implies. The path risks appearing to request information without offering a meaningful clearing outcome.

## Path 7 — Represented diet-conflict ingredient

**Restriction:** Vegetarian or vegan.

**Current deterministic rule(s):** The applicable diet’s confirmed, uncertain, and absent animal-derived ingredient rules.

**Current clarification question:** “Can the ingredient list or person who prepared it confirm whether this contains [ingredient]?”

**Current trigger:** A represented ingredient covered by the selected diet policy is likely, possible, unknown, or lacks admissible evidence; no ingredient-specific contradiction exists; no prior unknown user answer exists; and its evidence is conventional inference or weaker than confirmed.

**Why this clarification exists today:** Confirmed presence produces Avoid; reliable confirmed absence clears that ingredient condition.

**Possible user answers:**

- **Confirmed present:** Produces Avoid.
- **Confirmed absent:** Clears the represented ingredient concern and may support Safe when complete ingredient coverage and global adequacy are otherwise satisfied.
- **Unknown:** Preserves Need More Information and suppresses repetition for that ingredient.

**Can different answers change the deterministic recommendation? YES.**

**Decision Value: High.** It distinguishes a confirmed diet conflict from an explicit local absence.

**Typical User Can Answer? MAYBE.** A complete ingredient list or preparer may answer; hidden derivatives are often difficult for a normal user.

**Recommendation: Keep.** The question has direct, restriction-specific decision value.

**Decision Philosophy Compliance:** Generally compliant. Complete ingredient coverage remains independently required for a Safe result, so absence of one ingredient does not certify the whole food.

## Path 8 — Orphan mapped diet uncertainty

**Restriction:** Vegetarian or vegan.

**Current deterministic rule(s):** The applicable diet’s uncertain, confirmed, and absent animal-derived ingredient rules plus global Safe adequacy.

**Current clarification question:** The same ingredient-presence question used for represented ingredients.

**Current trigger:** A consequential, user-resolvable ingredient uncertainty names exactly one recognized diet-conflict ingredient, but no corresponding ingredient record exists. Vague, ambiguous, and precautionary text is excluded.

**Why this clarification exists today:** The rule creates a scoped ingredient target so the user can confirm or deny the named possible conflict.

**Possible user answers:**

- **Confirmed present:** Creates a confirmed ingredient with user evidence and produces Avoid.
- **Confirmed absent:** Creates an absent ingredient and locally clears it. However, the original orphan uncertainty has no explicit related fact association, so clarification resolution does not remove it. Global adequacy can therefore retain Need More Information.
- **Unknown:** Creates an unknown ingredient, retains the original uncertainty, and remains Need More Information without another identical question.

**Can different answers change the deterministic recommendation? YES.** Confirmed presence produces Avoid; the other answers remain Need More Information in the audited orphan case.

**Decision Value: Medium.** The question can detect an avoid-level conflict, but its negative answer does not fully resolve the uncertainty that caused the question.

**Typical User Can Answer? MAYBE.** Answerability depends on access to a complete label or preparer.

**Recommendation: Needs Product Decision.** Product must decide whether a question whose positive answer is decisive but whose negative answer cannot clear the triggering uncertainty satisfies the intended clarification standard.

**Decision Philosophy Compliance:** Partial. It has asymmetric decision value and exposes a mismatch between question association and global unknown handling. It is not merely descriptive, but it does not provide two fully usable resolution branches.

# Notable Observations

- The engine returns at most one question and the application consumes exactly that engine-selected question.
- Selection is deterministic but not explicitly value-ranked. Sorting favors verdict, status, risk, evidence confidence, restriction order, rule identifier, and source order. It does not simulate answer outcomes.
- Avoid is an absolute clarification suppression boundary. This is already aligned with “strong evidence can outweigh unrelated uncertainty.”
- An unknown user answer is preserved as unknown evidence and suppresses repeated questioning. This avoids loops.
- Contradictions generally prevent clarification in the affected local rule rather than inviting a question that cannot resolve competing evidence.
- Clarification patches trigger the full deterministic evaluation entry point; no provider or extraction call occurs.
- The result screen displays only the selected question and constrained options are shown only after the user enters the clarification flow.
- Unknown presentation merges rule missing information, non-informational extraction uncertainties, and contradictions. It does not tell the user whether each unknown could change the verdict.

# Product Risks

1. **Misleading resolution expectation:** A user may provide a clearing answer and still receive Need More Information because the original uncertainty is not explicitly associated or because Safe adequacy requires stronger coverage.
2. **Question priority without decision-value ranking:** With multiple unresolved restrictions or multiple ingredients, the first deterministic question may not be the most useful question.
3. **Generic component wording:** “Is this food fully cooked?” may not identify the particular animal, sprout, dough, or batter component that activates the rule.
4. **Normal-user knowledge limits:** Ingredient derivatives, pasteurization, component doneness, and label interpretation may not be answerable without packaging or preparer access.
5. **Confidence and contradiction breadth:** Recommendation confidence is capped by any contradiction, including one unrelated to decisive evidence. The decision philosophy requires materiality to the decisive evidence.
6. **Unclassified unknowns in presentation:** Users cannot currently distinguish an unknown that blocks the recommendation from one that is retained only for transparency.

# Open Product Questions

- Must every non-unknown answer option be capable of changing or resolving the final verdict, or is one decisive branch sufficient?
- Should an affirmative avoid-level answer justify asking when a negative answer cannot satisfy global adequacy?
- What qualifies as the highest decision value when several questions could each lead to Avoid?
- Should restriction priority, likelihood of user knowledge, or magnitude of verdict change control question selection?
- Should pregnancy questions name the relevant component rather than the whole food?
- What evidence may a normal user provide for sodium: a qualitative label statement, a numeric amount and serving, or either?
- When a local rule clears but an unassociated consequential uncertainty remains, should the product describe that as the same unresolved issue or a separate coverage limitation?
- How should unrelated contradictions affect confidence when decisive evidence is otherwise intact?
- How should the result explain that an unknown was retained but could not change an already justified recommendation?

# Recommended Priorities for Phase 2

| Priority | Affected area | Expected product benefit | Implementation complexity | Estimated risk |
| --- | --- | --- | --- | --- |
| 1 | Clarification selection audit | Ensure every displayed question has demonstrated final-verdict value and suppress questions after a fully justified recommendation | Medium | Medium |
| 2 | Explicit fact association review | Make clearing answers resolve only the exact triggering uncertainty and avoid surprising persistent Need More Information outcomes | Medium | Medium |
| 3 | High-blood-pressure clarification semantics | Align the question and answer branches with the sodium evidence the reviewed rules can use | Medium | High, because medical-rule provenance must remain reviewed |
| 4 | Multi-question prioritization policy | Select the single question with the greatest decision value across simultaneous restrictions | Medium | Medium |
| 5 | Pregnancy question specificity | Improve normal-user answerability by making the scoped concern understandable without changing medical rules | Low to medium | Low |
| 6 | Unknown explanation policy | Distinguish verdict-changing, relevant non-verdict-changing, and irrelevant unknowns in product explanation | Medium | Low |
| 7 | Cross-restriction consistency review | Align equivalent ingredient-presence clarification behavior while preserving each rule’s ownership and provenance | Medium | Medium |

These priorities identify product behavior to review next. They do not define new schemas, interfaces, rule priorities, or implementation plans.
