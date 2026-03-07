import { useState } from "react";
import { Shield, Terminal, FileText, Activity, History, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import LogInput from "@/components/LogInput";
import AnalysisResults, { AnalysisResult } from "@/components/AnalysisResults";
import LiveMonitor from "@/components/LiveMonitor";
import AnalysisHistory from "@/components/AnalysisHistory";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";

const Index = () => {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user, signOut } = useAuth();

  const saveToHistory = async (data: AnalysisResult, source: string) => {
    await supabase.from("analysis_history").insert({
      total_lines: data.summary.total_lines,
      suspicious_count: data.summary.suspicious_count,
      threat_level: data.summary.threat_level,
      findings: JSON.parse(JSON.stringify(data.findings)),
      source,
      user_id: user?.id,
    });
  };

  const handleAnalyze = async (logs: string) => {
    setIsLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-logs", {
        body: { logs },
      });
      if (error) throw error;
      const analysisResult = data as AnalysisResult;
      setResult(analysisResult);
      await saveToHistory(analysisResult, "manual");
    } catch (err: any) {
      toast({
        title: "Analysis Failed",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      <div className="fixed inset-0 scanline z-10" />

      <div className="relative z-20 max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center glow-primary">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                LogSentry
                <span className="text-xs font-mono text-primary animate-pulse-glow">● ONLINE</span>
              </h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Terminal className="h-3 w-3" />
                Suspicious Activity Detection Engine
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-mono hidden sm:block">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-3 w-3 mr-1" /> Sign Out
            </Button>
          </div>
        </header>

        <Tabs defaultValue="live" className="space-y-6">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="live" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Activity className="h-3.5 w-3.5" />
              Live Monitor
            </TabsTrigger>
            <TabsTrigger value="analyze" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <FileText className="h-3.5 w-3.5" />
              Paste & Analyze
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <History className="h-3.5 w-3.5" />
              History
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 className="h-3.5 w-3.5" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="live">
            <LiveMonitor onSaveHistory={saveToHistory} />
          </TabsContent>

          <TabsContent value="analyze" className="space-y-8">
            <LogInput onAnalyze={handleAnalyze} isLoading={isLoading} />
            <AnalysisResults result={result} />
          </TabsContent>

          <TabsContent value="history">
            <AnalysisHistory />
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
