import { AlertTriangle, ShieldAlert, ShieldCheck, Info, Flame, Brain, Radar, Target, Fingerprint, Search, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export interface Finding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: string;
  description: string;
  evidence: string[];
  recommendation: string;
  detection_method?: string;
  confidence?: number;
}

export interface AnomalyScores {
  ip_anomaly: number;
  request_anomaly: number;
  auth_anomaly: number;
  payload_anomaly: number;
}

export interface AnalysisResult {
  summary: {
    total_lines: number;
    suspicious_count: number;
    threat_level: string;
  };
  findings: Finding[];
  ai_summary?: string;
  anomaly_scores?: AnomalyScores;
  analysis_type?: "ai" | "rule";
}

const severityConfig = {
  critical: { icon: Flame, color: "bg-threat-critical", label: "CRITICAL" },
  high: { icon: ShieldAlert, color: "bg-threat-high", label: "HIGH" },
  medium: { icon: AlertTriangle, color: "bg-threat-medium text-primary-foreground", label: "MEDIUM" },
  low: { icon: ShieldCheck, color: "bg-threat-low text-primary-foreground", label: "LOW" },
  info: { icon: Info, color: "bg-threat-info", label: "INFO" },
};

const detectionMethodConfig: Record<string, { icon: typeof Brain; label: string }> = {
  anomaly_detection: { icon: Radar, label: "Anomaly Detection" },
  pattern_recognition: { icon: Fingerprint, label: "Pattern Recognition" },
  brute_force_detection: { icon: Target, label: "Brute Force Detection" },
  suspicious_login: { icon: Search, label: "Suspicious Login" },
  signature_matching: { icon: ShieldAlert, label: "Signature Matching" },
  behavioral_analysis: { icon: Activity, label: "Behavioral Analysis" },
};

interface AnalysisResultsProps {
  result: AnalysisResult | null;
}

const AnomalyScoreBar = ({ label, score }: { label: string; score: number }) => {
  const color =
    score >= 70 ? "bg-threat-critical" : score >= 40 ? "bg-threat-medium" : "bg-threat-low";
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-mono font-bold text-foreground">{score}/100</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
};

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

  const isAI = result.analysis_type === "ai";

  return (
    <div className="space-y-6">
      {/* AI Badge */}
      {isAI && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-primary">AI-Powered Analysis</span>
            <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
              ML Engine
            </Badge>
          </div>
          {result.ai_summary && (
            <p className="text-sm text-muted-foreground leading-relaxed">{result.ai_summary}</p>
          )}
        </div>
      )}

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

      {/* Anomaly Scores */}
      {isAI && result.anomaly_scores && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Radar className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold tracking-tight">Anomaly Detection Scores</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AnomalyScoreBar label="IP Anomaly" score={result.anomaly_scores.ip_anomaly} />
            <AnomalyScoreBar label="Request Pattern" score={result.anomaly_scores.request_anomaly} />
            <AnomalyScoreBar label="Authentication" score={result.anomaly_scores.auth_anomaly} />
            <AnomalyScoreBar label="Payload / Input" score={result.anomaly_scores.payload_anomaly} />
          </div>
        </div>
      )}

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
            const methodInfo = finding.detection_method
              ? detectionMethodConfig[finding.detection_method]
              : null;
            const MethodIcon = methodInfo?.icon || Brain;

            return (
              <div key={i} className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-3 p-4 border-b border-border flex-wrap">
                  <Badge className={`${config.color} text-xs font-mono`}>
                    <Icon className="h-3 w-3 mr-1" />
                    {config.label}
                  </Badge>
                  <span className="text-sm font-medium">{finding.category}</span>
                  {methodInfo && (
                    <Badge variant="outline" className="text-[10px] font-mono gap-1 border-primary/20 text-primary ml-auto">
                      <MethodIcon className="h-3 w-3" />
                      {methodInfo.label}
                    </Badge>
                  )}
                  {finding.confidence != null && (
                    <Badge variant="outline" className="text-[10px] font-mono border-muted-foreground/30">
                      {Math.round(finding.confidence * 100)}% conf
                    </Badge>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-sm text-foreground">{finding.description}</p>

                  {/* Confidence bar */}
                  {finding.confidence != null && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Confidence</p>
                      <Progress value={finding.confidence * 100} className="h-1.5" />
                    </div>
                  )}

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
