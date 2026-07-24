# Decision Philosophy

Milestone 2 exists to make the product’s recommendations more directly evidence-driven. The current architecture preserves uncertainty and supports constrained clarification, but it can treat a missing fact as a reason to ask a question even when confirmed evidence may already be sufficient for the recommendation. This creates a risk of over-clarification: the product may pursue a more complete description of the food without improving the decision.

This document defines product decision behavior, not an implementation design. It does not add rules, schemas, fields, or presentation components. Medical and dietary rules must continue to rely on reviewed evidence, rule-specific provenance, documented assumptions, and stated scope limitations.

## 1. The problem being solved

Food images rarely provide complete knowledge. An image may support a food identity, a visible ingredient, or a preparation observation while leaving sauces, hidden ingredients, label details, or preparation conditions unresolved. The product must represent those limits honestly, but it should not assume that every limit prevents a recommendation.

Two conditions must remain distinct:

- **Incomplete knowledge** means some facts about the food are missing, uncertain, or contradictory.
- **Insufficient evidence for a decision** means the available evidence does not support a recommendation under the applicable reviewed rules.

Incomplete knowledge does not automatically imply insufficient evidence. A confirmed observation may activate a rule whose recommendation cannot be changed by unrelated missing details. In that case, delaying the recommendation for descriptive completeness adds friction without improving safety or decision quality.

Conversely, missing information is decision-relevant when plausible answers would lead the deterministic rules to meaningfully different recommendations. The product must preserve such an unknown and should seek one useful answer when the user can reasonably provide it. The goal is neither to eliminate uncertainty nor to ask until the food is fully characterized. The goal is to make the strongest recommendation justified by supported evidence while clearly showing the limits of that recommendation.

## 2. Core principles

### Evidence comes before completeness

The application does not need to know every detail about a food. It needs enough supported evidence to justify the recommendation under an existing deterministic rule. Completeness may improve description, but it must not become an unstated prerequisite for every decision.

### Unknown information is not automatically decision-relevant

Unknown facts must remain represented. They must not automatically trigger clarification, lower the recommendation, or weaken confidence. Their effect depends on whether plausible answers could change the recommendation for an active restriction.

### Clarification requires decision value

A clarification question should be asked only when different plausible answers could produce meaningfully different recommendations. The question should resolve a specific, consequential unknown; it must not exist merely to collect more detail or increase confidence.

### Strong evidence can outweigh unrelated uncertainty

Confirmed evidence that supports a higher-priority recommendation may be sufficient even when other food details remain unknown. Unrelated uncertainty must not delay that recommendation. A contradiction that directly challenges the supposedly decisive evidence is not unrelated and must remain material.

### The recommendation must remain explainable

The product must identify the evidence that affected the recommendation, retain material unknowns, and explain whether those unknowns could change the outcome. It should also make clear why a clarification was requested or why none was required.

### Deterministic rules remain the sole verdict owner

AI extracts structured facts, evidence, uncertainty, and contradictions. It does not decide whether evidence is decisive and does not produce the final recommendation. Only reviewed deterministic rules may interpret facts, determine decision relevance, aggregate outcomes, and own the verdict.

### Recommendations should be as decisive as the available evidence allows.

The application should make the strongest recommendation that can be justified by the confirmed evidence.

It should not weaken or delay a recommendation merely because unrelated information remains unknown.

When evidence is sufficient for a reviewed deterministic rule, the recommendation should be returned immediately together with an explanation of any remaining relevant unknowns.

## 3. Decision hierarchy

The intended conceptual sequence is:

1. Review confirmed and sufficiently supported evidence.
2. Determine whether that evidence already justifies a recommendation.
3. If it does, return that recommendation.
4. Preserve relevant unknowns without automatically asking about them.
5. If the evidence is not sufficient, determine whether one clarification answer could realistically change the recommendation.
6. Ask only the highest-value clarification question.
7. If no answerable clarification can resolve the decision, return Need More Information with a clear explanation.

The sequence can be summarized as:

```text
Supported evidence
        |
        v
Is a recommendation already justified?
    | yes                    | no
    v                        v
Return it              Is there one answerable,
Preserve unknowns      verdict-changing unknown?
Explain why                | yes          | no
                           v              v
                    Ask one question   Need More Information
                                       Explain what is missing
```

This hierarchy does not permit a rule to ignore evidence quality, relevant contradictions, or its reviewed scope. It changes the purpose of clarification from “complete the picture” to “resolve a decision that cannot yet be supported.”

## 4. Clarification policy

### Ask when

A clarification question should be asked when:

- plausible answers can lead to different verdicts;
- the missing fact is relevant to an active profile restriction;
- the user can reasonably answer the question;
- the question is specific and actionable; and
- no stronger existing evidence has already determined the outcome.

Only one question should be asked at a time, and it should have the greatest decision value among the currently answerable unknowns.

### Do not ask when

A clarification question should not be asked when:

- the answer cannot change the final recommendation;
- the missing fact is unrelated to the active restriction;
- confirmed evidence already supports a higher-priority verdict;
- the question would only increase descriptive completeness;
- the answer is unlikely to be known by the user; or
- the purpose is merely to increase confidence.

The following examples are illustrative explanations of this policy. They are not new medical or dietary rules and apply only where the current reviewed rule registry already supports the stated interpretation.

- **Pregnancy plus confirmed raw fish:** If admissible evidence activates the existing reviewed raw-animal preparation rule and supports Avoid, unknown rice or sauce details should not trigger clarification unless they directly contradict or undermine that evidence.
- **Allergy plus a confirmed allergen:** If reliable evidence confirms a selected allergen, the existing allergy rule supports Avoid. Questions about unrelated ingredients should not delay that result.
- **Vegan profile plus confirmed meat:** If admissible evidence confirms an existing diet-policy conflict, other unknown ingredients should not prevent the supported Avoid recommendation.
- **Pregnancy plus cheese with unknown pasteurization:** When the applicable reviewed rule cannot determine the recommendation without pasteurization status, and the user may be able to verify it, asking the constrained pasteurization question has decision value.
- **Allergy plus an unresolved mixed dish:** If a selected allergen may be a hidden ingredient and confirmed presence and confirmed absence would lead to different outcomes, a specific ingredient-presence question may be warranted. An answer that the user does not know must leave the uncertainty unresolved.

## 5. Decisive evidence

**Decisive evidence** is evidence that is sufficient, under an existing reviewed deterministic rule, to produce a recommendation without requiring unrelated missing details.

Decisive evidence belongs to deterministic rule interpretation, not to the AI provider. It must be restriction-specific and traceable to an existing reviewed rule. It does not mean that the whole image or food is fully understood, and it never permits the system to invent facts. Depending on the applicable rule, it may justify Avoid, Safe with Caution, or another supported verdict. It does not automatically imply high extraction confidence or high recommendation confidence. A material contradiction that directly challenges the evidence must not be suppressed.

The relevant distinctions are:

- **Decisive evidence** is sufficient for the rule-supported recommendation.
- **Supporting evidence** strengthens or explains a finding but is not independently sufficient for the recommendation.
- **Relevant unknowns** concern an active restriction or the recommendation; some are verdict-changing and some are not.
- **Irrelevant unknowns** have no meaningful connection to an active restriction or the recommendation.
- **Contradictions** are competing supported claims. A contradiction is material when it challenges a fact used to decide; otherwise it remains visible without automatically controlling the verdict.

These concepts describe product behavior. Phase 0 does not prescribe a production schema for representing them.

## 6. Unknown-information policy

### Verdict-changing unknown

A verdict-changing unknown is a missing fact whose plausible answers could change the recommendation. It should support clarification when the user can reasonably answer a constrained question. If it cannot be resolved through clarification, it should remain prominent in a Need More Information result. It should limit recommendation confidence and the explanation must state what decision depends on it.

### Relevant but non-verdict-changing unknown

This unknown is connected to the food or an active restriction but cannot override the current recommendation. It should not trigger clarification. It may appear in the result when it helps the user understand the recommendation’s limits. It may affect confidence only when it materially limits the evidence supporting the recommendation; its mere existence must not reduce confidence. The explanation should state that the detail remains unknown but does not change the current recommendation.

### Irrelevant unknown

An irrelevant unknown has no meaningful connection to the active restriction or recommendation. It must not trigger clarification or affect the verdict or recommendation confidence. It may be omitted from the primary result explanation to preserve focus, although the underlying structured fact must not be falsely converted into a known value. User-facing copy should not elevate it into a safety concern.

Classification is contextual. The same missing fact may have decision value for one active restriction and none for another. The deterministic rule layer must own that interpretation.

## 7. Result-explanation principles

Every result should eventually answer:

- What did the application observe?
- Which evidence affected the recommendation?
- What remains unknown?
- Could those unknowns change the recommendation?
- Why did the application ask or not ask a clarification question?
- Which deterministic rule produced the recommendation?

The explanation should lead with the recommendation and the evidence sufficient to support it, without hiding uncertainty. It should distinguish extraction confidence from recommendation confidence and must not present either as medical certainty. Evidence provenance should remain understandable, and rule ownership should be visible without exposing provider output or internal prompts.

An illustrative result structure is:

```text
Recommendation

Decisive evidence

Other observations

Unknown details

Why no clarification was required
```

For a result that requires clarification, the final section may instead explain which decision depends on the answer. This structure is illustrative only; it does not redesign the React UI or prescribe component names.

## 8. Safety boundaries

The product must never:

- invent evidence;
- treat visual confidence as medical certainty;
- hide material contradictions;
- suppress an unknown that could change the recommendation;
- allow AI-generated language to override deterministic rules;
- ask questions solely to appear cautious;
- delay a justified recommendation because unrelated details are missing;
- claim that a food is guaranteed safe; or
- expand medical scope without reviewed evidence and provenance.

These boundaries take priority over convenience, brevity, confidence, and completion rate.

## 9. Non-goals for Phase 0

Phase 0 does not:

- modify application behavior;
- modify clarification logic;
- modify rule priority;
- add decisive-evidence fields;
- change extraction prompts or schemas;
- change verdict aggregation;
- redesign result presentation;
- add new dietary restrictions;
- add new medical guidance;
- modify tests; or
- modify `IMPLEMENTATION_PLAN.md`.

## 10. Open questions for Phase 1

The clarification audit must answer:

- Which existing clarification questions can actually change a verdict?
- Which rules already contain evidence sufficient to decide without asking?
- How should contradictions interact with otherwise decisive evidence?
- How should competing simultaneous restrictions affect clarification?
- When several verdict-changing unknowns exist, which question has the highest decision value?
- How should the system explain that an unknown was retained but did not influence the recommendation?
- Should recommendation confidence change when an unknown is relevant but demonstrably non-verdict-changing?
- What evidence is required to show that every clarification option has a meaningful decision effect?

These questions require product and rule review. They must not be answered through unreviewed architecture changes or new medical policy.
