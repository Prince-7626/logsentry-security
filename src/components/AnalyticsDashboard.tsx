import { useEffect, useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Globe, Crosshair, RefreshCw, CalendarIcon, Download } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { Finding } from "@/components/AnalysisResults";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

interface HistoryRow {
  id: string;
  total_lines: number;
  suspicious_count: number;
  threat_level: string;
  findings: Finding[];
  source: string;
  created_at: string;
}

const THREAT_COLORS: Record<string, string> = {
  Critical: "hsl(0, 72%, 55%)",
  High: "hsl(25, 90%, 55%)",
  Medium: "hsl(38, 92%, 55%)",
  Low: "hsl(174, 72%, 50%)",
};

const PIE_COLORS = [
  "hsl(0, 72%, 55%)",
  "hsl(25, 90%, 55%)",
  "hsl(38, 92%, 55%)",
  "hsl(174, 72%, 50%)",
  "hsl(220, 60%, 60%)",
  "hsl(280, 60%, 60%)",
];

const PRESET_RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All", days: null },
] as const;

const AnalyticsDashboard = () => {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [activePreset, setActivePreset] = useState<string>("30d");

  const fetchHistory = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("analysis_history")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(200);

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

  const filteredHistory = useMemo(() => {
    if (!dateRange?.from) return history;
    const from = startOfDay(dateRange.from);
    const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
    return history.filter((entry) => {
      const date = parseISO(entry.created_at);
      return isWithinInterval(date, { start: from, end: to });
    });
  }, [history, dateRange]);

  const handlePreset = (days: number | null) => {
    if (days === null) {
      setDateRange(undefined);
      setActivePreset("All");
    } else {
      setDateRange({ from: subDays(new Date(), days), to: new Date() });
      setActivePreset(`${days}d`);
    }
  };

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    setActivePreset("");
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const headers = ["Date", "Threat Level", "Total Lines", "Suspicious Count", "Source", "Findings Count", "Finding Severities", "Finding Categories"];
    const rows = filteredHistory.map((entry) => [
      format(parseISO(entry.created_at), "yyyy-MM-dd HH:mm:ss"),
      entry.threat_level,
      entry.total_lines,
      entry.suspicious_count,
      entry.source,
      entry.findings.length,
      entry.findings.map((f) => f.severity).join("; "),
      entry.findings.map((f) => f.category).join("; "),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    downloadFile(csv, `logsentry-analytics-${format(new Date(), "yyyy-MM-dd")}.csv`, "text/csv");
  };

  const exportPDF = () => {
    const dateLabel_ = dateRange?.from
      ? dateRange.to
        ? `${format(dateRange.from, "MMM d, yyyy")} – ${format(dateRange.to, "MMM d, yyyy")}`
        : format(dateRange.from, "MMM d, yyyy")
      : "All time";

    const totalFindings = filteredHistory.reduce((s, e) => s + e.findings.length, 0);
    const severityCounts: Record<string, number> = {};
    filteredHistory.forEach((e) =>
      e.findings.forEach((f) => {
        const label = f.severity.charAt(0).toUpperCase() + f.severity.slice(1);
        severityCounts[label] = (severityCounts[label] || 0) + 1;
      })
    );

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>LogSentry Threat Report</title>
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 40px; color: #1a1a2e; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 22px; border-bottom: 2px solid #0d9488; padding-bottom: 8px; }
  h2 { font-size: 16px; color: #475569; margin-top: 28px; }
  .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; }
  .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }
  .stat { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center; }
  .stat .value { font-size: 28px; font-weight: 700; }
  .stat .label { font-size: 11px; color: #64748b; margin-top: 4px; }
  .critical { color: #dc2626; } .high { color: #ea580c; } .medium { color: #d97706; } .low { color: #0d9488; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
  th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
  th { background: #f1f5f9; font-weight: 600; color: #334155; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; color: white; }
  .badge-critical { background: #dc2626; } .badge-high { background: #ea580c; } .badge-medium { background: #d97706; } .badge-low { background: #0d9488; }
  .footer { margin-top: 32px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
</style></head><body>
<h1>🛡️ LogSentry Threat Report</h1>
<p class="meta">Period: ${dateLabel_} · Generated: ${format(new Date(), "PPpp")}</p>

<div class="stat-grid">
  <div class="stat"><div class="value">${filteredHistory.length}</div><div class="label">Analyses</div></div>
  <div class="stat"><div class="value critical">${totalFindings}</div><div class="label">Total Findings</div></div>
  <div class="stat"><div class="value">${filteredHistory.reduce((s, e) => s + e.suspicious_count, 0)}</div><div class="label">Suspicious Events</div></div>
</div>

<h2>Severity Breakdown</h2>
<div class="stat-grid" style="grid-template-columns: repeat(4, 1fr);">
  ${["Critical", "High", "Medium", "Low"]
    .map(
      (s) =>
        `<div class="stat"><div class="value ${s.toLowerCase()}">${severityCounts[s] || 0}</div><div class="label">${s}</div></div>`
    )
    .join("")}
</div>

<h2>Analysis Details</h2>
<table>
  <tr><th>Date</th><th>Threat</th><th>Lines</th><th>Suspicious</th><th>Findings</th><th>Source</th></tr>
  ${filteredHistory
    .slice()
    .reverse()
    .slice(0, 50)
    .map(
      (e) =>
        `<tr><td>${format(parseISO(e.created_at), "MMM d, HH:mm")}</td><td><span class="badge badge-${e.threat_level.toLowerCase()}">${e.threat_level}</span></td><td>${e.total_lines}</td><td>${e.suspicious_count}</td><td>${e.findings.length}</td><td>${e.source}</td></tr>`
    )
    .join("")}
</table>
${filteredHistory.length > 50 ? `<p class="meta">Showing 50 of ${filteredHistory.length} analyses</p>` : ""}

<h2>Top Findings</h2>
<table>
  <tr><th>Severity</th><th>Category</th><th>Description</th></tr>
  ${filteredHistory
    .flatMap((e) => e.findings)
    .slice(0, 30)
    .map(
      (f) =>
        `<tr><td><span class="badge badge-${f.severity}">${f.severity.toUpperCase()}</span></td><td>${f.category}</td><td>${f.description}</td></tr>`
    )
    .join("")}
</table>

<div class="footer">LogSentry · Suspicious Activity Detection Engine · Report auto-generated</div>
</body></html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 500);
    }
  };

  const threatOverTime = useMemo(() => {
    const grouped: Record<string, { date: string; Critical: number; High: number; Medium: number; Low: number }> = {};
    filteredHistory.forEach((entry) => {
      const day = format(parseISO(entry.created_at), "MMM d");
      if (!grouped[day]) grouped[day] = { date: day, Critical: 0, High: 0, Medium: 0, Low: 0 };
      const level = entry.threat_level as keyof typeof grouped[string];
      if (level in grouped[day]) {
        (grouped[day] as any)[level]++;
      }
    });
    return Object.values(grouped);
  }, [filteredHistory]);

  const topIPs = useMemo(() => {
    const ipCount: Record<string, number> = {};
    filteredHistory.forEach((entry) => {
      entry.findings.forEach((f) => {
        f.evidence.forEach((e) => {
          const ipMatch = e.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
          if (ipMatch) {
            ipCount[ipMatch[0]] = (ipCount[ipMatch[0]] || 0) + 1;
          }
        });
      });
    });
    return Object.entries(ipCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([ip, count]) => ({ ip, count }));
  }, [filteredHistory]);

  const topEndpoints = useMemo(() => {
    const epCount: Record<string, number> = {};
    filteredHistory.forEach((entry) => {
      entry.findings.forEach((f) => {
        f.evidence.forEach((e) => {
          const pathMatch = e.match(/(?:GET|POST|PUT|DELETE|PATCH)\s+(\/\S+)/i);
          if (pathMatch) {
            const path = pathMatch[1].split("?")[0];
            epCount[path] = (epCount[path] || 0) + 1;
          }
        });
      });
    });
    return Object.entries(epCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([endpoint, count]) => ({ endpoint, count }));
  }, [filteredHistory]);

  const severityDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredHistory.forEach((entry) => {
      entry.findings.forEach((f) => {
        const label = f.severity.charAt(0).toUpperCase() + f.severity.slice(1);
        counts[label] = (counts[label] || 0) + 1;
      });
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredHistory]);

  if (loading && history.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Loading analytics...</p>;
  }

  if (history.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground">No data yet. Run some analyses to see charts.</p>
      </div>
    );
  }

  const customTooltipStyle = {
    backgroundColor: "hsl(220, 18%, 10%)",
    border: "1px solid hsl(220, 15%, 18%)",
    borderRadius: "0.5rem",
    fontSize: "12px",
    color: "hsl(180, 10%, 88%)",
  };

  const dateLabel = dateRange?.from
    ? dateRange.to
      ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d, yyyy")}`
      : format(dateRange.from, "MMM d, yyyy")
    : "All time";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Threat Analytics
        </h2>
        <div className="flex items-center gap-2">
          {/* Preset buttons */}
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            {PRESET_RANGES.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePreset(preset.days)}
                className={cn(
                  "px-3 py-1.5 text-xs font-mono transition-colors",
                  activePreset === preset.label
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-secondary"
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom date range picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs font-mono">
                <CalendarIcon className="h-3 w-3" />
                {dateLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={handleDateRangeSelect}
                numberOfMonths={2}
                disabled={(date) => date > new Date()}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="h-3 w-3" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportCSV}>Download CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={exportPDF}>Print / Save as PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={fetchHistory} disabled={loading}>
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Summary stat */}
      <p className="text-xs text-muted-foreground font-mono">
        Showing {filteredHistory.length} of {history.length} analyses
      </p>

      {/* Threat Distribution Over Time */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5" />
            Threat Levels Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          {threatOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={threatOverTime} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                <XAxis dataKey="date" tick={{ fill: "hsl(220, 10%, 50%)", fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: "hsl(220, 10%, 50%)", fontSize: 11 }} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Bar dataKey="Critical" stackId="a" fill={THREAT_COLORS.Critical} radius={[0, 0, 0, 0]} />
                <Bar dataKey="High" stackId="a" fill={THREAT_COLORS.High} />
                <Bar dataKey="Medium" stackId="a" fill={THREAT_COLORS.Medium} />
                <Bar dataKey="Low" stackId="a" fill={THREAT_COLORS.Low} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">No data in selected range</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Attacking IPs */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Globe className="h-3.5 w-3.5" />
              Top Attacking IPs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topIPs.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topIPs} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: "hsl(220, 10%, 50%)", fontSize: 11 }} />
                  <YAxis dataKey="ip" type="category" width={110} tick={{ fill: "hsl(220, 10%, 50%)", fontSize: 10, fontFamily: "JetBrains Mono" }} />
                  <Tooltip contentStyle={customTooltipStyle} />
                  <Bar dataKey="count" fill="hsl(0, 72%, 55%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">No IP data in selected range</p>
            )}
          </CardContent>
        </Card>

        {/* Severity Distribution Pie */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              Severity Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {severityDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={severityDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {severityDistribution.map((entry, index) => (
                      <Cell key={entry.name} fill={THREAT_COLORS[entry.name] || PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={customTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">No findings in selected range</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Most Targeted Endpoints */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Crosshair className="h-3.5 w-3.5" />
            Most Targeted Endpoints
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topEndpoints.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topEndpoints} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                <XAxis type="number" allowDecimals={false} tick={{ fill: "hsl(220, 10%, 50%)", fontSize: 11 }} />
                <YAxis dataKey="endpoint" type="category" width={140} tick={{ fill: "hsl(220, 10%, 50%)", fontSize: 10, fontFamily: "JetBrains Mono" }} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Bar dataKey="count" fill="hsl(38, 92%, 55%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">No endpoint data in selected range</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsDashboard;
