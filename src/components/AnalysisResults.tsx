import { AlertTriangle, ShieldAlert, ShieldCheck, Info, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface Finding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: string;
  description: string;
  evidence: string[];
  recommendation: string;
}

export interface AnalysisResult {
  summary: {
    total_lines: number;
    suspicious_count: number;
    threat_level: string;
  };
  findings: Finding[];
}

const severityConfig = {
  critical: { icon: Flame, color: "bg-threat-critical", label: "CRITICAL" },
  high: { icon: ShieldAlert, color: "bg-threat-high", label: "HIGH" },
  medium: { icon: AlertTriangle, color: "bg-threat-medium text-primary-foreground", label: "MEDIUM" },
  low: { icon: ShieldCheck, color: "bg-threat-low text-primary-foreground", label: "LOW" },
  info: { icon: Info, color: "bg-threat-info", label: "INFO" },
};

interface AnalysisResultsProps {
  result: AnalysisResult | null;
}

const AnalysisResults = ({ result }: AnalysisResultsProps) => {
  if (!result) return null;

  const threatColor =
    result.summary.threat_level === "Critical"
      ? "text-threat-critical"
      : result.summary.threat_level === "High"
      ? "text-threat-high"
      : result.summary.threat_level === "Medium"
      ? "text-threat-medium"
      : "text-threat-low";

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-3xl font-bold font-mono text-foreground">{result.summary.total_lines}</p>
          <p className="text-xs text-muted-foreground mt-1">Lines Analyzed</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-3xl font-bold font-mono text-threat-critical">{result.summary.suspicious_count}</p>
          <p className="text-xs text-muted-foreground mt-1">Suspicious Events</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className={`text-3xl font-bold font-mono ${threatColor}`}>{result.summary.threat_level}</p>
          <p className="text-xs text-muted-foreground mt-1">Threat Level</p>
        </div>
      </div>

      {/* Findings */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight">Findings</h3>
        {result.findings.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <ShieldCheck className="h-8 w-8 text-threat-low mx-auto mb-2" />
            <p className="text-muted-foreground">No suspicious activity detected.</p>
          </div>
        ) : (
          result.findings.map((finding, i) => {
            const config = severityConfig[finding.severity];
            const Icon = config.icon;
            return (
              <div key={i} className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-3 p-4 border-b border-border">
                  <Badge className={`${config.color} text-xs font-mono`}>
                    <Icon className="h-3 w-3 mr-1" />
                    {config.label}
                  </Badge>
                  <span className="text-sm font-medium">{finding.category}</span>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-sm text-foreground">{finding.description}</p>
                  {finding.evidence.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Evidence</p>
                      <div className="bg-background rounded-md p-3 space-y-1 max-h-32 overflow-y-auto">
                        {finding.evidence.map((e, j) => (
                          <p key={j} className="log-line text-xs text-muted-foreground">{e}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2 bg-primary/5 rounded-md p-3">
                    <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-xs text-primary">{finding.recommendation}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AnalysisResults;
