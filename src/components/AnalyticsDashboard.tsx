import { useEffect, useState, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Globe, Crosshair, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Finding } from "@/components/AnalysisResults";
import { format, parseISO } from "date-fns";

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

const AnalyticsDashboard = () => {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

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

  const threatOverTime = useMemo(() => {
    const grouped: Record<string, { date: string; Critical: number; High: number; Medium: number; Low: number }> = {};
    history.forEach((entry) => {
      const day = format(parseISO(entry.created_at), "MMM d");
      if (!grouped[day]) grouped[day] = { date: day, Critical: 0, High: 0, Medium: 0, Low: 0 };
      const level = entry.threat_level as keyof typeof grouped[string];
      if (level in grouped[day]) {
        (grouped[day] as any)[level]++;
      }
    });
    return Object.values(grouped);
  }, [history]);

  const topIPs = useMemo(() => {
    const ipCount: Record<string, number> = {};
    history.forEach((entry) => {
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
  }, [history]);

  const topEndpoints = useMemo(() => {
    const epCount: Record<string, number> = {};
    history.forEach((entry) => {
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
  }, [history]);

  const severityDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    history.forEach((entry) => {
      entry.findings.forEach((f) => {
        const label = f.severity.charAt(0).toUpperCase() + f.severity.slice(1);
        counts[label] = (counts[label] || 0) + 1;
      });
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [history]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Threat Analytics
        </h2>
        <Button variant="outline" size="sm" onClick={fetchHistory} disabled={loading}>
          <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

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
            <p className="text-xs text-muted-foreground text-center py-8">No data</p>
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
              <p className="text-xs text-muted-foreground text-center py-8">No IP data extracted from findings</p>
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
              <p className="text-xs text-muted-foreground text-center py-8">No findings data</p>
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
            <p className="text-xs text-muted-foreground text-center py-8">No endpoint data extracted from findings</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsDashboard;
