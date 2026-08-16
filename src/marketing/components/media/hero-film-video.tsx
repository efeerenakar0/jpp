"use client";

import { useEffect, useRef } from "react";

export function HeroFilmVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

    const syncPlayback = () => {
      if (motionPreference.matches) {
        video.pause();
        video.currentTime = 0;
        return;
      }

      void video.play().catch(() => {
        // The poster remains a complete fallback when autoplay is unavailable.
      });
    };

    syncPlayback();
    motionPreference.addEventListener("change", syncPlayback);

    return () => {
      motionPreference.removeEventListener("change", syncPlayback);
      video.pause();
    };
  }, []);

  return (
    <video
      aria-hidden="true"
      className="bceo-hero-film__video"
      loop
      muted
      playsInline
      poster="/posters/business-ceo-hero.webp"
      preload="metadata"
      ref={videoRef}
    >
      <source src="/media/videos/business-ceo-hero.webm" type="video/webm" />
      <source src="/media/videos/business-ceo-hero.mp4" type="video/mp4" />
    </video>
  );
}
