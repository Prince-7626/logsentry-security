import { useState, useEffect, useRef, useCallback } from "react";
import { Activity, Pause, Play, Trash2, AlertTriangle, Shield, Zap, Volume2, VolumeX, Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { generateLogEntry, LogEntry } from "@/lib/logGenerator";
import { supabase } from "@/integrations/supabase/client";
import { AnalysisResult } from "@/components/AnalysisResults";
import { playAlertSound, requestNotificationPermission, sendThreatNotification } from "@/lib/alertSystem";

const MAX_LOGS = 200;
const ANALYZE_INTERVAL = 15000;

const levelColors: Record<string, string> = {
  INFO: "text-threat-low",
  WARN: "text-threat-medium",
  ERROR: "text-threat-critical",
};

interface LiveMonitorProps {
  onSaveHistory?: (data: AnalysisResult, source: string) => Promise<void>;
}

const LiveMonitor = ({ onSaveHistory }: LiveMonitorProps) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(true);
  const [speed, setSpeed] = useState<number>(800);
  const [stats, setStats] = useState({ total: 0, suspicious: 0, errors: 0 });
  const [liveThreats, setLiveThreats] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyzeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logsRef = useRef<LogEntry[]>([]);
  const prevThreatCountRef = useRef(0);

  // Keep ref in sync
  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  const addLog = useCallback(() => {
    const entry = generateLogEntry();
    setLogs((prev) => {
      const next = [...prev, entry].slice(-MAX_LOGS);
      return next;
    });
    setStats((prev) => ({
      total: prev.total + 1,
      suspicious: prev.suspicious + (entry.isSuspicious ? 1 : 0),
      errors: prev.errors + (entry.level === "ERROR" ? 1 : 0),
    }));
  }, []);

  const runAnalysis = useCallback(async () => {
    const currentLogs = logsRef.current;
    if (currentLogs.length === 0) return;
    setIsAnalyzing(true);
    try {
      const rawLogs = currentLogs.map((l) => l.raw).join("\n");
      const { data, error } = await supabase.functions.invoke("analyze-logs", {
        body: { logs: rawLogs },
      });
      if (!error && data) {
        const result = data as AnalysisResult;
        setLiveThreats(result);

        // Alert on new threats
        const newCount = result.findings.length;
        if (newCount > prevThreatCountRef.current && newCount > 0) {
          const topSeverity = result.findings[0]?.severity || "medium";
          const alertLevel = topSeverity === "critical" ? "critical" : topSeverity === "high" ? "high" : "medium";

          if (soundEnabled) {
            playAlertSound(alertLevel);
          }
          if (notificationsEnabled) {
            const critCount = result.findings.filter((f) => f.severity === "critical").length;
            const highCount = result.findings.filter((f) => f.severity === "high").length;
            sendThreatNotification(
              `⚠️ ${newCount} Threat${newCount > 1 ? "s" : ""} Detected`,
              `${critCount} critical, ${highCount} high severity finding${highCount !== 1 ? "s" : ""} in latest scan.`
            );
          }
        }
        prevThreatCountRef.current = newCount;

        // Save to history when threats found
        if (result.findings.length > 0 && onSaveHistory) {
          onSaveHistory(result, "live-monitor");
        }
      }
    } catch {
      // silent fail for live monitor
    } finally {
      setIsAnalyzing(false);
    }
  }, [soundEnabled, notificationsEnabled]);

  // Streaming interval
  useEffect(() => {
    if (isStreaming) {
      intervalRef.current = setInterval(addLog, speed);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isStreaming, speed, addLog]);

  // Auto-analyze interval
  useEffect(() => {
    analyzeRef.current = setInterval(runAnalysis, ANALYZE_INTERVAL);
    return () => {
      if (analyzeRef.current) clearInterval(analyzeRef.current);
    };
  }, [runAnalysis]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [logs]);

  const clearLogs = () => {
    setLogs([]);
    setStats({ total: 0, suspicious: 0, errors: 0 });
    setLiveThreats(null);
    prevThreatCountRef.current = 0;
  };

  const toggleNotifications = async () => {
    if (!notificationsEnabled) {
      const granted = await requestNotificationPermission();
      setNotificationsEnabled(granted);
    } else {
      setNotificationsEnabled(false);
    }
  };

  const suspiciousRate = stats.total > 0 ? ((stats.suspicious / stats.total) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant={isStreaming ? "default" : "outline"}
            size="sm"
            onClick={() => setIsStreaming(!isStreaming)}
          >
            {isStreaming ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
            {isStreaming ? "Pause" : "Resume"}
          </Button>
          <Button variant="outline" size="sm" onClick={clearLogs}>
            <Trash2 className="h-3 w-3 mr-1" /> Clear
          </Button>
          <Button variant="outline" size="sm" onClick={runAnalysis} disabled={isAnalyzing}>
            <Shield className="h-3 w-3 mr-1" /> {isAnalyzing ? "Analyzing..." : "Analyze Now"}
          </Button>
          <Button
            variant={soundEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "Mute alerts" : "Enable sound alerts"}
          >
            {soundEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
          </Button>
          <Button
            variant={notificationsEnabled ? "default" : "outline"}
            size="sm"
            onClick={toggleNotifications}
            title={notificationsEnabled ? "Disable notifications" : "Enable browser notifications"}
          >
            {notificationsEnabled ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Speed:</span>
          {[1200, 800, 400, 150].map((s) => (
            <Button
              key={s}
              variant={speed === s ? "default" : "outline"}
              size="sm"
              className="text-xs px-2 h-7"
              onClick={() => setSpeed(s)}
            >
              {s <= 150 ? "Fast" : s <= 400 ? "Med" : s <= 800 ? "Slow" : "Chill"}
            </Button>
          ))}
        </div>
      </div>

      {/* Live Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold font-mono text-foreground">{stats.total}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Logs</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold font-mono text-threat-medium">{stats.suspicious}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Suspicious</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold font-mono text-threat-critical">{stats.errors}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Errors</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold font-mono text-primary">{suspiciousRate}%</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Threat Rate</p>
        </div>
      </div>

      {/* Live Threat Banner */}
      {liveThreats && liveThreats.findings.length > 0 && (
        <div className="rounded-lg border border-threat-critical/30 bg-threat-critical/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-threat-critical" />
            <span className="text-sm font-semibold text-threat-critical">
              {liveThreats.findings.length} Active Threat{liveThreats.findings.length > 1 ? "s" : ""} Detected
            </span>
            {isAnalyzing && <Zap className="h-3 w-3 text-threat-medium animate-pulse-glow" />}
          </div>
          <div className="flex flex-wrap gap-2">
            {liveThreats.findings.map((f, i) => (
              <Badge
                key={i}
                className={`text-[10px] font-mono ${
                  f.severity === "critical"
                    ? "bg-threat-critical"
                    : f.severity === "high"
                    ? "bg-threat-high"
                    : "bg-threat-medium text-primary-foreground"
                }`}
              >
                {f.category}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Log Stream */}
      <div className="rounded-lg border border-border bg-background overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card">
          <Activity
            className={`h-3 w-3 ${isStreaming ? "text-primary animate-pulse-glow" : "text-muted-foreground"}`}
          />
          <span className="text-xs font-mono text-muted-foreground">
            LIVE STREAM — {logs.length} lines buffered
          </span>
        </div>
        <ScrollArea className="h-[400px]" ref={scrollRef}>
          <div className="p-2 space-y-0">
            {logs.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">
                {isStreaming ? "Waiting for logs..." : "Stream paused. Click Resume to start."}
              </p>
            ) : (
              logs.map((entry) => (
                <div
                  key={entry.id}
                  className={`log-line flex items-start gap-2 ${
                    entry.isSuspicious ? "bg-threat-critical/5 border-l-2 border-threat-critical/40" : ""
                  }`}
                >
                  <span className="text-muted-foreground text-xs shrink-0 w-[135px]">
                    [{entry.timestamp}]
                  </span>
                  <span className={`text-xs font-bold w-12 shrink-0 ${levelColors[entry.level]}`}>
                    {entry.level}
                  </span>
                  <span className="text-xs text-muted-foreground w-[110px] shrink-0">{entry.ip}</span>
                  <span className="text-xs text-foreground truncate">
                    {entry.method} {entry.path} {entry.status} {entry.responseTime}ms
                    {entry.message && <span className="text-muted-foreground"> {entry.message}</span>}
                  </span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default LiveMonitor;
