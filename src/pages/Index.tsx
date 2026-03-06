import { useState } from "react";
import { Shield, Terminal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import LogInput from "@/components/LogInput";
import AnalysisResults, { AnalysisResult } from "@/components/AnalysisResults";

const Index = () => {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleAnalyze = async (logs: string) => {
    setIsLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-logs", {
        body: { logs },
      });

      if (error) throw error;
      setResult(data as AnalysisResult);
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
      {/* Scanline overlay */}
      <div className="fixed inset-0 scanline z-10" />

      <div className="relative z-20 max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="flex items-center gap-3 mb-8">
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
        </header>

        <div className="grid gap-8">
          <LogInput onAnalyze={handleAnalyze} isLoading={isLoading} />
          <AnalysisResults result={result} />
        </div>
      </div>
    </div>
  );
};

export default Index;
