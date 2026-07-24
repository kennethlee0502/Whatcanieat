import Link from "next/link";

import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={`app-canvas ${styles.canvas}`}>
      <main className={`content-shell ${styles.page}`}>
        <p className={styles.brand}>Can / I Eat This?</p>

        <section className={styles.introduction} aria-labelledby="landing-title">
          <p className={styles.eyebrow}>Food decision support</p>
          <h1 id="landing-title" className={styles.title}>
            A clearer way to check food against your needs.
          </h1>
          <p className={styles.summary}>
            Add a food photo and choose the dietary restrictions that matter to
            you. We show the evidence behind the guidance—and what the image
            cannot confirm.
          </p>
        </section>

        <section className={styles.scope} aria-labelledby="supported-scope">
          <h2 id="supported-scope" className={styles.scopeTitle}>
            Supported right now
          </h2>
          <p>
            Pregnancy, food allergies, high blood pressure, vegetarian, and
            vegan needs.
          </p>
        </section>

        <div className={styles.action}>
          <Link className={styles.primaryAction} href="/app">
            Check a food
          </Link>
          <p className={styles.limitation}>
            This is decision support, not medical advice or a guarantee of
            safety. When important details are uncertain, they stay visible.
          </p>
        </div>

        <footer className={styles.footer}>
          <nav aria-label="Product information">
            <Link href="/privacy">Privacy</Link>
            <Link href="/build">How it works</Link>
          </nav>
        </footer>
      </main>
    </div>
  );
}
