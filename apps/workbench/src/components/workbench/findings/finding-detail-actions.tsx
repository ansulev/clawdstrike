/**
 * Finding Detail Actions Bar
 *
 * Renders action buttons for a finding's detail view, including
 * lifecycle transitions and threat reporting. The "Report to..."
 * button only appears for confirmed findings.
 */

import { useState, useCallback, useMemo } from "react";
import {
  IconCheck,
  IconBan,
  IconArrowUpRight,
  IconX,
  IconSend,
} from "@tabler/icons-react";
import type { Finding, ExtractedIoc } from "@/lib/workbench/finding-engine";
import { ReportThreatDialog } from "./report-threat-dialog";

// ---- Types ----

interface FindingDetailActionsProps {
  finding: Finding;
  onConfirm: (findingId: string) => void;
  onDismiss: (findingId: string) => void;
  onPromote: (findingId: string) => void;
  onMarkFalsePositive: (findingId: string) => void;
  getApiKey: (service: string) => Promise<string | null>;
  mispBaseUrl?: string;
}

// ---- Component ----

export function FindingDetailActions({
  finding,
  onConfirm,
  onDismiss,
  onPromote,
  onMarkFalsePositive,
  getApiKey,
  mispBaseUrl,
}: FindingDetailActionsProps) {
  const [showReportDialog, setShowReportDialog] = useState(false);

  // Extract IOC indicators from finding enrichments
  const indicators = useMemo<ExtractedIoc[]>(() => {
    const iocEnrichments = finding.enrichments.filter(
      (e) => e.type === "ioc_extraction",
    );
    const allIndicators: ExtractedIoc[] = [];
    for (const enrichment of iocEnrichments) {
      const items = (enrichment.data.indicators ?? []) as ExtractedIoc[];
      allIndicators.push(...items);
    }
    return allIndicators;
  }, [finding.enrichments]);

  const handleOpenReport = useCallback(() => {
    setShowReportDialog(true);
  }, []);

  const handleCloseReport = useCallback(() => {
    setShowReportDialog(false);
  }, []);

  return (
    <>
      <div className="flex items-center gap-1.5">
        {finding.status === "emerging" && (
          <>
            <ActionButton
              label="Confirm"
              icon={<IconCheck size={12} stroke={2} />}
              color="#d4a84b"
              onClick={() => onConfirm(finding.id)}
            />
            <ActionButton
              label="Dismiss"
              icon={<IconBan size={12} stroke={1.5} />}
              color="#6f7f9a"
              onClick={() => onDismiss(finding.id)}
            />
          </>
        )}
        {finding.status === "confirmed" && (
          <>
            <ActionButton
              label="Promote to Intel"
              icon={<IconArrowUpRight size={12} stroke={2} />}
              color="#3dbf84"
              onClick={() => onPromote(finding.id)}
            />
            <ActionButton
              label="Report to..."
              icon={<IconSend size={12} stroke={1.5} />}
              color="#d4a84b"
              onClick={handleOpenReport}
            />
            <ActionButton
              label="Mark FP"
              icon={<IconX size={12} stroke={1.5} />}
              color="#6f7f9a"
              onClick={() => onMarkFalsePositive(finding.id)}
            />
          </>
        )}
      </div>

      <ReportThreatDialog
        open={showReportDialog}
        onClose={handleCloseReport}
        finding={finding}
        indicators={indicators}
        getApiKey={getApiKey}
        mispBaseUrl={mispBaseUrl}
      />
    </>
  );
}

// ---- Sub-components ----

function ActionButton({
  label,
  icon,
  color,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors border"
      style={{
        color,
        borderColor: color + "25",
        backgroundColor: color + "10",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = color + "20";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = color + "10";
      }}
    >
      {icon}
      {label}
    </button>
  );
}
