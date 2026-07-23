"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";

import styles from "@/app/app/result-flow.module.css";
import type {
  ConfidenceLevel,
  EvaluationReason,
  EvaluationResult,
  RuleMatch,
  SupportedRestriction,
  Verdict,
} from "@/domain/evaluation";
import type {
  EvidenceItem,
  ExtractedFoodFacts,
} from "@/domain/food";
import type { PreparedImage } from "@/lib/image-lifecycle";

const verdictContent: Readonly<
  Record<
    Verdict,
    Readonly<{ label: string; interpretation: string; className: string }>
  >
> = {
  safe: {
    label: "Safe",
    interpretation:
      "No supported conflict was found with adequate evidence.",
    className: styles.safe,
  },
  safeWithCaution: {
    label: "Safe with caution",
    interpretation:
      "No avoid-level conflict is known, but a moderate concern applies.",
    className: styles.caution,
  },
  avoid: {
    label: "Avoid",
    interpretation:
      "Confirmed information conflicts with a restriction you selected.",
    className: styles.avoid,
  },
  needMoreInformation: {
    label: "Need more information",
    interpretation:
      "A missing detail could change this recommendation.",
    className: styles.unknown,
  },
};

const confidenceLabels: Readonly<Record<ConfidenceLevel, string>> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const evidenceSourceLabels: Readonly<
  Record<EvidenceItem["source"], string>
> = {
  visibleInImage: "Visible in image",
  readableOnLabel: "Readable on label",
  conventionalInference: "Conventional inference",
  userProvided: "User provided",
};

const evidenceStrengthLabels: Readonly<
  Record<EvidenceItem["strength"], string>
> = {
  confirmed: "Confirmed",
  likely: "Likely",
  possible: "Possible",
  unknown: "Unknown",
};

const restrictionLabels: Readonly<Record<SupportedRestriction, string>> = {
  pregnancy: "Pregnancy",
  allergy: "Food allergy",
  highBloodPressure: "High blood pressure",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
};

const outcomeLabel = (match: RuleMatch | undefined) => {
  if (!match) {
    return "Supported check";
  }
  if (match.status === "cleared") {
    return "No conflict found";
  }
  if (match.status === "notApplicable") {
    return "Not applicable";
  }
  return verdictContent[match.recommendedVerdict].label;
};

const EvidenceDetails = ({
  evidence,
}: Readonly<{ evidence: EvidenceItem }>) => (
  <div className={styles.evidence}>
    <p className={styles.evidenceSummary}>{evidence.summary}</p>
    <dl className={styles.metadata}>
      <div>
        <dt>Source</dt>
        <dd>{evidenceSourceLabels[evidence.source]}</dd>
      </div>
      <div>
        <dt>Strength</dt>
        <dd>{evidenceStrengthLabels[evidence.strength]}</dd>
      </div>
    </dl>
  </div>
);

const UnresolvedEvidenceDetails = () => (
  <div className={styles.evidence}>
    <p className={styles.evidenceSummary}>
      No supporting observation was confirmed.
    </p>
    <dl className={styles.metadata}>
      <div>
        <dt>Source</dt>
        <dd>Not available</dd>
      </div>
      <div>
        <dt>Strength</dt>
        <dd>Unknown</dd>
      </div>
    </dl>
  </div>
);

const ReasonDetails = ({
  reason,
  evaluation,
  evidenceById,
}: Readonly<{
  reason: EvaluationReason;
  evaluation: EvaluationResult;
  evidenceById: ReadonlyMap<string, EvidenceItem>;
}>) => {
  const match = evaluation.ruleMatches.find(
    ({ rule }) => rule.id === reason.ruleId,
  );
  const supportingEvidence = reason.evidenceIds.flatMap((id) => {
    const evidence = evidenceById.get(id);
    return evidence ? [evidence] : [];
  });
  const [primaryEvidence, ...additionalEvidence] = supportingEvidence;

  return (
    <li className={styles.reason}>
      <p className={styles.reasonSummary}>{reason.summary}</p>
      <dl className={styles.reasonMetadata}>
        <div>
          <dt>Affected restriction</dt>
          <dd>
            {match
              ? restrictionLabels[match.rule.restriction]
              : "Supported profile"}
          </dd>
        </div>
        <div>
          <dt>Outcome</dt>
          <dd>{outcomeLabel(match)}</dd>
        </div>
      </dl>

      {primaryEvidence ? (
        <EvidenceDetails evidence={primaryEvidence} />
      ) : (
        <UnresolvedEvidenceDetails />
      )}

      {additionalEvidence.length > 0 ? (
        <details className={styles.additionalEvidence}>
          <summary>More supporting evidence</summary>
          <div className={styles.additionalEvidenceList}>
            {additionalEvidence.map((evidence) => (
              <EvidenceDetails key={evidence.id} evidence={evidence} />
            ))}
          </div>
        </details>
      ) : null}
    </li>
  );
};

const getObservedEvidence = (facts: ExtractedFoodFacts) =>
  facts.evidence
    .filter(
      ({ source }) =>
        source === "visibleInImage" || source === "readableOnLabel",
    )
    .slice(0, 3);

const getUnknowns = (
  facts: ExtractedFoodFacts,
  evaluation: EvaluationResult,
) =>
  [
    ...evaluation.missingInformation,
    ...facts.uncertainties
      .filter(({ safetyRelevance }) => safetyRelevance !== "informational")
      .map(({ description }) => description),
    ...facts.contradictions.map(({ description }) => description),
  ].filter((value, index, values) => values.indexOf(value) === index);

type ResultFlowProps = Readonly<{
  preparedImage: PreparedImage;
  facts: ExtractedFoodFacts;
  evaluation: EvaluationResult;
  onNewScan: () => void;
}>;

export const ResultFlow = ({
  preparedImage,
  facts,
  evaluation,
  onNewScan,
}: ResultFlowProps) => {
  const prefersReducedMotion = useReducedMotion();
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const evidenceById = useMemo(
    () =>
      new Map(
        [...facts.evidence, ...evaluation.evidence].map((evidence) => [
          evidence.id,
          evidence,
        ]),
      ),
    [evaluation.evidence, facts.evidence],
  );
  const observedEvidence = getObservedEvidence(facts);
  const unknowns = getUnknowns(facts, evaluation);
  const verdict = verdictContent[evaluation.verdict];
  const clarification = evaluation.clarificationQuestions[0];

  useEffect(() => {
    resultHeadingRef.current?.focus();
  }, []);

  return (
    <motion.main
      className={`content-shell ${styles.flow}`}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: prefersReducedMotion ? 0 : 0.4,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <p className={styles.brand}>Can / I Eat This?</p>
      <p className={styles.resultAnnouncement} role="status" aria-live="polite">
        Result ready. {verdict.label}.
      </p>

      <div className={styles.previewFrame}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.previewImage}
          src={preparedImage.objectUrl}
          alt="Selected food image"
        />
      </div>

      <section className={styles.section} aria-labelledby="what-we-saw">
        <h1
          ref={resultHeadingRef}
          id="what-we-saw"
          className={styles.sectionTitle}
          tabIndex={-1}
        >
          What we saw
        </h1>
        <p className={styles.lead}>
          {evaluation.identifiedFood ?? "The food could not be identified."}
        </p>
        <p className={styles.confidence}>
          Extraction confidence:{" "}
          {confidenceLabels[facts.extractionConfidence]}
        </p>
        {observedEvidence.length > 0 ? (
          <ul className={styles.observationList}>
            {observedEvidence.map((evidence) => (
              <li key={evidence.id}>{evidence.summary}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className={styles.section} aria-labelledby="what-we-know">
        <h2 id="what-we-know" className={styles.sectionTitle}>
          What we know
        </h2>
        {evaluation.reasons.length > 0 ? (
          <ol className={styles.reasonList}>
            {evaluation.reasons.map((reason) => (
              <ReasonDetails
                key={reason.id}
                reason={reason}
                evaluation={evaluation}
                evidenceById={evidenceById}
              />
            ))}
          </ol>
        ) : observedEvidence.length > 0 ? (
          <div className={styles.knownEvidence}>
            {observedEvidence.map((evidence) => (
              <EvidenceDetails key={evidence.id} evidence={evidence} />
            ))}
          </div>
        ) : (
          <p className={styles.bodyText}>
            No additional supported facts were confirmed.
          </p>
        )}
      </section>

      <section className={styles.section} aria-labelledby="what-we-dont-know">
        <h2 id="what-we-dont-know" className={styles.sectionTitle}>
          What we don’t know
        </h2>
        {unknowns.length > 0 ? (
          <ul className={styles.unknownList}>
            {unknowns.map((unknown) => (
              <li key={unknown}>{unknown}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.bodyText}>
            No consequential unknowns were identified for the supported checks.
          </p>
        )}

        {clarification ? (
          <div className={styles.clarification}>
            <p className={styles.eyebrow}>One useful detail to check</p>
            <p className={styles.clarificationPrompt}>
              {clarification.prompt}
            </p>
            <p className={styles.bodyText}>{clarification.whyItMatters}</p>
          </div>
        ) : null}
      </section>

      <section className={styles.recommendation} aria-labelledby="recommendation">
        <h2 id="recommendation" className={styles.sectionTitle}>
          Recommendation
        </h2>
        <div className={`${styles.verdict} ${verdict.className}`}>
          <p className={styles.verdictLabel}>{verdict.label}</p>
          <p className={styles.verdictInterpretation}>
            {verdict.interpretation}
          </p>
        </div>

        {evaluation.reasons.length > 0 ? (
          <div className={styles.recommendationReasons}>
            <h3>Why</h3>
            <ol>
              {evaluation.reasons.map((reason) => (
                <li key={reason.id}>{reason.summary}</li>
              ))}
            </ol>
          </div>
        ) : null}

        <p className={styles.confidence}>
          Recommendation confidence:{" "}
          {confidenceLabels[evaluation.recommendationConfidence]}
        </p>

        <div className={styles.nextAction}>
          <h3>What to do next</h3>
          <p>{evaluation.nextAction}</p>
        </div>

        <p className={styles.scope}>{evaluation.supportedScopeStatement}</p>
      </section>

      <button className={styles.primaryButton} type="button" onClick={onNewScan}>
        Check another food
      </button>
    </motion.main>
  );
};
