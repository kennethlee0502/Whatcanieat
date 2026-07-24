import type { Metadata } from "next";

import { InformationPage } from "@/components/information-page";
import styles from "@/components/information-page.module.css";

export const metadata: Metadata = {
  title: "How It Works | Can / I Eat This?",
  description:
    "How Can / I Eat This? separates food-fact extraction from deterministic dietary evaluation.",
};

export default function BuildPage() {
  return (
    <InformationPage>
      <header>
        <p className={styles.eyebrow}>How it works</p>
        <h1 className={styles.title}>Evidence before conclusions.</h1>
        <p className={styles.lede}>
          The product tests a simple hypothesis: careful evidence and visible
          uncertainty can make a food decision more useful without pretending
          a photo can answer everything.
        </p>
      </header>

      <section className={styles.section}>
        <h2>From image to guidance</h2>
        <ol>
          <li>A prepared food image and minimized profile reach the server.</li>
          <li>AI extracts structured food facts, evidence, and unknowns.</li>
          <li>The output is validated and normalized.</li>
          <li>Deterministic TypeScript rules evaluate the supported needs.</li>
          <li>A validated response presents the evidence and recommendation.</li>
        </ol>
      </section>

      <section className={styles.section}>
        <h2>AI extracts facts. Rules make the decision.</h2>
        <p>
          AI may identify food candidates, visible or label-supported details,
          preparation observations, possible ingredients, contradictions, and
          missing facts. Text visible in an image is treated as untrusted data,
          never as an instruction.
        </p>
        <p>
          The AI does not produce the verdict. Validated, normalized facts enter
          the deterministic rule engine, which evaluates the selected
          restrictions and remains the sole owner of the recommendation.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Only relevant profile context is used</h2>
        <p>
          Analysis receives only allowlisted restriction information.
          Measurements and locally calculated BMI stay out of extraction and
          rule evaluation.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Evidence and uncertainty stay separate</h2>
        <p>
          Evidence keeps its source and strength. Unsupported details remain
          unknown, and contradictory observations remain represented rather
          than being silently resolved. The result explains what was observed,
          what is supported, and what still needs checking.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Deterministic rule provenance</h2>
        <p>
          The current safety-rule definitions are versioned and carry reviewed
          source guidance, references, assumptions, and scope limitations.
          Evaluation results preserve the matching rule identifiers and
          versions so the recommendation can be traced to the rule that
          produced it.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Trade-offs and limitations</h2>
        <p>
          A photo cannot reliably reveal every hidden ingredient, preparation
          detail, or label value. Extraction can be incomplete, and the rule
          engine covers only the supported restrictions and reviewed rule
          definitions. Network or provider failures can also prevent an
          analysis.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Future possibilities</h2>
        <p>
          This page documents only the current implementation. It intentionally
          avoids speculative commitments about features, infrastructure, or
          expanded dietary and medical scope.
        </p>
      </section>
    </InformationPage>
  );
}
