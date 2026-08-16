"use client";

import { useEffect, useRef, type ReactNode } from "react";

export interface SpatialCapabilityFieldProps {
  readonly children: ReactNode;
}

/**
 * Adds one restrained, field-level depth response without turning the capability
 * panels into floating controls. Touch and reduced-motion users keep the same
 * authored static composition.
 */
export function SpatialCapabilityField({ children }: SpatialCapabilityFieldProps) {
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const field = fieldRef.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const precisePointer = window.matchMedia("(pointer: fine)");

    if (!field) {
      return;
    }

    let frame = 0;
    let isListening = false;

    const updateField = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = field.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
        const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
        const normalX = (x - 0.5) * 2;
        const normalY = (y - 0.5) * 2;

        field.style.setProperty("--spatial-field-rx", `${(-normalY * 1.8).toFixed(2)}deg`);
        field.style.setProperty("--spatial-field-ry", `${(normalX * 2.6).toFixed(2)}deg`);
        field.style.setProperty("--spatial-field-light-x", `${(x * 100).toFixed(1)}%`);
        field.style.setProperty("--spatial-field-light-y", `${(y * 100).toFixed(1)}%`);
      });
    };

    const resetField = () => {
      cancelAnimationFrame(frame);
      field.style.setProperty("--spatial-field-rx", "0deg");
      field.style.setProperty("--spatial-field-ry", "0deg");
      field.style.setProperty("--spatial-field-light-x", "50%");
      field.style.setProperty("--spatial-field-light-y", "48%");
    };

    const syncInputMode = () => {
      const shouldListen = !reducedMotion.matches && precisePointer.matches;

      if (shouldListen && !isListening) {
        field.addEventListener("pointermove", updateField, { passive: true });
        field.addEventListener("pointerleave", resetField, { passive: true });
        isListening = true;
      } else if (!shouldListen && isListening) {
        field.removeEventListener("pointermove", updateField);
        field.removeEventListener("pointerleave", resetField);
        isListening = false;
        resetField();
      }
    };

    reducedMotion.addEventListener("change", syncInputMode);
    precisePointer.addEventListener("change", syncInputMode);
    syncInputMode();

    return () => {
      cancelAnimationFrame(frame);
      if (isListening) {
        field.removeEventListener("pointermove", updateField);
        field.removeEventListener("pointerleave", resetField);
      }
      reducedMotion.removeEventListener("change", syncInputMode);
      precisePointer.removeEventListener("change", syncInputMode);
      field.style.removeProperty("--spatial-field-rx");
      field.style.removeProperty("--spatial-field-ry");
      field.style.removeProperty("--spatial-field-light-x");
      field.style.removeProperty("--spatial-field-light-y");
    };
  }, []);

  return (
    <div
      className="bceo-spatial-product__field"
      data-spatial-capability-field
      ref={fieldRef}
    >
      <div className="bceo-spatial-product__axis" aria-hidden="true">
        <i />
        <span />
        <span />
        <span />
      </div>
      <div className="bceo-spatial-product__capabilities">{children}</div>
    </div>
  );
}
