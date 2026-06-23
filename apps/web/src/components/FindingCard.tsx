import { SeverityBadge } from "@/components/ui";
import { dismissFinding } from "@/app/owner/agent/actions";

export interface FindingView {
  id: string;
  title: string;
  detail: string;
  severity: string;
  suggested_action: string | null;
  confidence: number | null;
}

/** AI farm-check finding with a dismiss action. Shared by the dashboard + agent page. */
export function FindingCard({ finding, showConfidence = false }: { finding: FindingView; showConfidence?: boolean }) {
  return (
    <li className="rounded-tile border-l-2 border-line bg-surface p-4 pl-4" style={{ borderLeftColor: "var(--blue)" }}>
      <div className="flex items-start justify-between gap-3">
        <strong className="text-ink">{finding.title}</strong>
        <SeverityBadge severity={finding.severity} />
      </div>
      <p className="mt-1 text-sm text-ink-2">{finding.detail}</p>
      {finding.suggested_action && (
        <p className="mt-2 text-sm font-medium text-navy">→ {finding.suggested_action}</p>
      )}
      <div className="mt-3 flex items-center justify-between">
        {showConfidence && finding.confidence != null ? (
          <span className="font-mono text-xs text-ink-3">confidence {(finding.confidence * 100).toFixed(0)}%</span>
        ) : (
          <span />
        )}
        <form action={dismissFinding}>
          <input type="hidden" name="findingId" value={finding.id} />
          <button className="text-xs text-ink-2 underline hover:text-ink">Dismiss</button>
        </form>
      </div>
    </li>
  );
}
