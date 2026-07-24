import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./information-page.module.css";

type InformationPageProps = Readonly<{
  children: ReactNode;
}>;

export const InformationPage = ({ children }: InformationPageProps) => (
  <div className={`app-canvas ${styles.canvas}`}>
    <main className={`content-shell ${styles.page}`}>
      <Link className={styles.brand} href="/">
        Can / I Eat This?
      </Link>

      <div className={styles.content}>{children}</div>

      <footer className={styles.footer}>
        <Link className={styles.primaryAction} href="/app">
          Check a food
        </Link>
        <nav aria-label="Product information">
          <Link href="/">Home</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/build">How it works</Link>
        </nav>
      </footer>
    </main>
  </div>
);
