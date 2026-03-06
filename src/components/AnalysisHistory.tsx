import { useEffect, useState } from "react";
import { Clock, Trash2, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Finding } from "@/components/AnalysisResults";
import { format } from "date-fns";

interface HistoryRow {
  id: string;
  total_lines: number;
  suspicious_count: number;
  threat_level: string;
  findings: Finding[];
  source: string;
  created_at: string;
}

const threatBadge: Record<string, string> = {
  Critical: "bg-threat-critical",
  High: "bg-threat-high",
  Medium: "bg-threat-medium text-primary-foreground",
  Low: "bg-threat-low text-primary-foreground",
};

const AnalysisHistory = () => {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("analysis_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      setHistory(
        data.map((row) => ({
          ...row,
          findings: (row.findings ?? []) as unknown as Finding[],
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (id: string) => {
    await supabase.from("analysis_history").delete().eq("id", id);
    setHistory((prev) => prev.filter((h) => h.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Analysis History
        </h2>
        <Button variant="outline" size="sm" onClick={fetchHistory} disabled={loading}>
          <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {loading && history.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading history...</p>
      ) : history.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No analysis history yet. Run an analysis to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((entry) => {
            const isExpanded = expandedId === entry.id;
            return (
              <div key={entry.id} className="rounded-lg border border-border bg-card overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-3 hover:bg-secondary/50 transition-colors text-left"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge className={`${threatBadge[entry.threat_level] || "bg-muted"} text-[10px] font-mono`}>
                      {entry.threat_level}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      {format(new Date(entry.created_at), "MMM d, yyyy HH:mm:ss")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {entry.total_lines} lines · {entry.suspicious_count} suspicious · {entry.findings.length} finding{entry.findings.length !== 1 ? "s" : ""}
                    </span>
                    <Badge variant="outline" className="text-[10px]">{entry.source}</Badge>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(entry.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && entry.findings.length > 0 && (
                  <div className="border-t border-border p-3 space-y-2">
                    {entry.findings.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <Badge className={`${threatBadge[f.severity.charAt(0).toUpperCase() + f.severity.slice(1)] || "bg-muted"} text-[9px] font-mono shrink-0`}>
                          {f.severity.toUpperCase()}
                        </Badge>
                        <div>
                          <span className="font-medium text-foreground">{f.category}</span>
                          <span className="text-muted-foreground"> — {f.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AnalysisHistory;
