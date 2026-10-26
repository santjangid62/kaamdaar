"use client";

import { useEffect, useRef } from "react";

/**
 * The footer year must match the visitor's clock, but calling `new Date()` at
 * render time would make the prerendered HTML unstable. Render a static
 * fallback and let the effect update the text node after mount.
 */
export default function Year() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.textContent = String(new Date().getFullYear());
  }, []);

  return <span ref={ref}>2026</span>;
}