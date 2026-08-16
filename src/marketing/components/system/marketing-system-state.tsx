import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./marketing-system-state.module.css";

interface MarketingSystemStateProps {
  readonly actions: ReactNode;
  readonly code: string;
  readonly description: string;
  readonly eyebrow: string;
  readonly title: string;
}

export function MarketingSystemState({
  actions,
  code,
  description,
  eyebrow,
  title,
}: MarketingSystemStateProps) {
  return (
    <main className={styles.shell}>
      <div className={styles.grid} aria-hidden="true" />
      <header className={styles.header}>
        <Link href="/tr" aria-label="Business CEO AI ana sayfa">
          <Image
            alt="Business CEO AI"
            height={887}
            priority
            src="/brand/business-ceo-ai-wordmark-transparent-dark-cyan.png"
            width={1774}
          />
        </Link>
        <span>
          <i aria-hidden="true" />
          Sistem durumu
        </span>
      </header>

      <section className={styles.content} aria-labelledby="system-state-title">
        <div className={styles.signal} aria-hidden="true">
          <span />
          <span />
          <span />
          <strong>{code}</strong>
        </div>

        <div className={styles.copy}>
          <p>{eyebrow}</p>
          <h1 id="system-state-title">{title}</h1>
          <span>{description}</span>
          <div className={styles.actions}>{actions}</div>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>Business operating system</span>
        <span>Sinyal · Bağlam · Aksiyon</span>
      </footer>
    </main>
  );
}
