import type { Metadata } from "next";

import { InformationPage } from "@/components/information-page";
import styles from "@/components/information-page.module.css";

export const metadata: Metadata = {
  title: "Privacy | Can / I Eat This?",
  description:
    "How Can / I Eat This? handles your temporary profile, food image, and analysis data.",
};

export default function PrivacyPage() {
  return (
    <InformationPage>
      <header>
        <p className={styles.eyebrow}>Privacy</p>
        <h1 className={styles.title}>Your data stays temporary.</h1>
        <p className={styles.lede}>
          There is no account, database, or scan history. The product keeps
          only what it needs for your current browser session and analysis.
        </p>
      </header>

      <section className={styles.section}>
        <h2>What stays in session storage</h2>
        <p>
          Your validated profile is saved in this browser&apos;s session
          storage so you can continue during the current session. It may include
          your selected restrictions and optional height and weight. Those
          measurements are used only for a local BMI calculation and do not
          affect recommendations.
        </p>
      </section>

      <section className={styles.section}>
        <h2>What stays only in memory</h2>
        <p>
          Your selected and prepared image, its temporary object URL, extracted
          food facts, result, clarification state, and analysis errors remain
          only in browser memory. They are not written to session storage or a
          scan history.
        </p>
      </section>

      <section className={styles.section}>
        <h2>What is sent for analysis</h2>
        <p>
          When you choose to analyze a food, the prepared image and only the
          relevant parts of your selected profile are sent to our server:
          pregnancy information when applicable, allergies and optional
          severity, high-blood-pressure status, and vegetarian or vegan
          preference.
        </p>
        <p>
          Height, weight, BMI, profile labels, storage metadata, and interface
          state are not sent for analysis.
        </p>
      </section>

      <section className={styles.section}>
        <h2>AI-provider processing</h2>
        <p>
          Our server sends the prepared image and minimized profile context to
          OpenAI to extract structured food facts. The server validates those
          facts before deterministic rules produce the result. The application
          does not intentionally log images, profiles, extracted facts, or
          results, and it has no server database for them.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Clear All</h2>
        <p>
          Clear All removes the saved session profile and resets temporary app
          data in memory. It also cancels active image or analysis work and
          releases temporary image URLs.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Important limits</h2>
        <p>
          This product is not HIPAA compliant. It provides decision support for
          selected dietary restrictions, not medical advice, diagnosis, or a
          guarantee that a food is safe.
        </p>
      </section>
    </InformationPage>
  );
}
