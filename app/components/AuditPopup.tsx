"use client";

import { useAuditModal } from "./AuditModalProvider";

type AuditPopupProps = {
  children: React.ReactNode;
  className?: string;
};

export default function AuditPopup({ children, className = "btn primary" }: AuditPopupProps) {
  const { openAudit } = useAuditModal();

  return (
    <button type="button" className={className} onClick={openAudit}>
      {children}
    </button>
  );
}
