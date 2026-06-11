"use client";

import { useState } from "react";

export function CopyButton({ value, label = "Copy link" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that block clipboard without interaction
      const el = document.createElement("textarea");
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex h-7 items-center gap-1 rounded-lg bg-emerald-50 px-2.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100"
    >
      {copied ? "✓ Copied!" : label}
    </button>
  );
}
