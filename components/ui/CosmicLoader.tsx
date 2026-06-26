import type { CSSProperties } from "react";
import styles from "./CosmicLoader.module.css";

// SP-5.6 "Cosmic Orrery" loader — the product's single loading indicator (sun + moon orbiting earth).
// Pure CSS (see CosmicLoader.module.css): no canvas/WebGL/JS animation loop. Reduced-motion → static pulse.
const SIZES: Record<"sm" | "md" | "lg", number> = { sm: 32, md: 56, lg: 96 };

export function CosmicLoader({
  size = "sm",
  variant = "auto",
  label,
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  variant?: "light" | "dark" | "auto";
  label?: string;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label ?? "Loading"}
      aria-live="polite"
      data-variant={variant}
      className={`${styles.loader} ${className}`}
      style={{ "--cl-size": `${SIZES[size]}px` } as CSSProperties}
    >
      <span className={styles.viewport} aria-hidden="true">
        {size === "lg" && (
          <>
            <span className={`${styles.ring} ${styles.ringSun}`} />
            <span className={`${styles.ring} ${styles.ringMoon}`} />
          </>
        )}
        <span className={`${styles.orbit} ${styles.sun}`}>
          <span className={styles.arm}>
            <span className={styles.sat}>
              <span className={styles.desquash}>
                <span className={styles.sunBody} />
              </span>
            </span>
          </span>
        </span>
        <span className={`${styles.orbit} ${styles.moon}`}>
          <span className={styles.arm}>
            <span className={styles.sat}>
              <span className={styles.desquash}>
                <span className={styles.moonBody} />
              </span>
            </span>
          </span>
        </span>
        <span className={styles.earth} />
      </span>
      {label && <span className={styles.label}>{label}</span>}
    </span>
  );
}
