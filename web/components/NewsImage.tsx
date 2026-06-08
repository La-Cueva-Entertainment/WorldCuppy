"use client";

import { useEffect, useState } from "react";

export function NewsImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(false);

  // Reset state whenever the src URL changes so stale error/visibility
  // doesn't carry over when the RSS feed re-fetches and returns new URLs.
  useEffect(() => {
    setVisible(false);
    setError(false);
  }, [src]);

  if (error) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onLoad={() => setVisible(true)}
      onError={() => setError(true)}
      className={className}
      style={visible ? undefined : { display: "none" }}
    />
  );
}
