"use client";

import { useEffect } from "react";

type Props = {
  src: string;
  alt: string;
  onClose: () => void;
};

export default function ScreenshotLightbox({ src, alt, onClose }: Props) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="lightbox-backdrop" role="presentation" onClick={onClose}>
      <img
        className="lightbox-img"
        src={src}
        alt={alt}
        onClick={(event) => event.stopPropagation()}
      />
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="Close screenshot">
        X
      </button>
    </div>
  );
}
