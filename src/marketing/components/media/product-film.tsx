"use client";

import { useEffect, useRef, useState } from "react";

export interface ProductFilmSource {
  readonly src: string;
  readonly type: "video/mp4" | "video/webm";
}

export interface ProductFilmCaption {
  readonly src: string;
  readonly srcLang: "en" | "tr";
  readonly label: string;
  readonly default?: boolean;
}

export interface ProductFilmProps {
  readonly captions: readonly ProductFilmCaption[];
  readonly description: string;
  readonly locale?: "en" | "tr";
  readonly poster: string;
  readonly sources: readonly ProductFilmSource[];
  readonly title: string;
}

const interfaceCopy = {
  en: {
    download: "Download the product film",
    silent: "Silent product film",
    synthetic: "Synthetic interface",
  },
  tr: {
    download: "Ürün filmini indirin",
    silent: "Sessiz ürün filmi",
    synthetic: "Sentetik arayüz",
  },
} as const;

export function ProductFilm({
  captions,
  description,
  locale = "en",
  poster,
  sources,
  title,
}: ProductFilmProps) {
  const copy = interfaceCopy[locale];
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPosterReady, setIsPosterReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !("IntersectionObserver" in window)) {
      setIsPosterReady(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }

        setIsPosterReady(true);
        observer.disconnect();
      },
      { rootMargin: "480px 0px" },
    );

    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="bceo-product-film"
      data-poster-state={isPosterReady ? "ready" : "deferred"}
      ref={containerRef}
    >
      <video
        aria-label={`${title}. ${description}`}
        className="bceo-product-film__video"
        controls
        playsInline
        poster={isPosterReady ? poster : undefined}
        preload="none"
      >
        {sources.map((source) => (
          <source key={source.src} src={source.src} type={source.type} />
        ))}
        {captions.map((caption) => (
          <track
            default={caption.srcLang === locale}
            key={caption.srcLang}
            kind="captions"
            label={caption.label}
            src={caption.src}
            srcLang={caption.srcLang}
          />
        ))}
        <a href={sources.at(-1)?.src}>{copy.download}</a>
      </video>
      <div className="bceo-product-film__note" aria-hidden="true">
        <span>{copy.silent}</span>
        <span>{copy.synthetic}</span>
      </div>
    </div>
  );
}
