"use client";

import { useState } from "react";

type CopyPathButtonProps = {
  value: string;
};

export default function CopyPathButton({ value }: CopyPathButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button type="button" className="cc-copy-btn" onClick={handleCopy}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
