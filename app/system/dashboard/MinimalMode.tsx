"use client";

import { useEffect } from "react";

const BODY_CLASS = "osdash-minimal";

export default function MinimalMode() {
  useEffect(() => {
    document.body.classList.add(BODY_CLASS);
    return () => {
      document.body.classList.remove(BODY_CLASS);
    };
  }, []);

  return null;
}
