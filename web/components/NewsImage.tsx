"use client";

import { useState } from "react";

export function NewsImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(false);

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
