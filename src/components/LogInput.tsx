import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Shield, Loader2 } from "lucide-react";

const SAMPLE_LOGS = `[2026-03-06 08:12:33] INFO 192.168.1.10 - GET /api/users 200 45ms
[2026-03-06 08:12:35] WARN 10.0.0.55 - POST /api/login 401 12ms "Invalid credentials"
[2026-03-06 08:12:36] WARN 10.0.0.55 - POST /api/login 401 8ms "Invalid credentials"
[2026-03-06 08:12:37] WARN 10.0.0.55 - POST /api/login 401 9ms "Invalid credentials"
[2026-03-06 08:12:38] WARN 10.0.0.55 - POST /api/login 401 7ms "Invalid credentials"
[2026-03-06 08:12:39] WARN 10.0.0.55 - POST /api/login 401 11ms "Invalid credentials"
[2026-03-06 08:12:40] ERROR 10.0.0.55 - Account locked after 5 failed attempts
[2026-03-06 08:13:01] INFO 192.168.1.22 - GET /api/products?id=1 OR 1=1 200 120ms
[2026-03-06 08:13:05] WARN 172.16.0.99 - GET /../../etc/passwd 403 2ms
[2026-03-06 08:13:10] INFO 192.168.1.10 - GET /api/dashboard 200 89ms
[2026-03-06 08:13:15] ERROR 10.0.0.77 - POST /api/upload 500 3400ms "File size exceeded"
[2026-03-06 08:13:20] WARN 192.168.1.22 - GET /api/users?search=<script>alert('xss')</script> 400 5ms
[2026-03-06 08:14:00] INFO 192.168.1.10 - DELETE /api/users/ALL 200 15ms
[2026-03-06 08:14:30] WARN 10.0.0.55 - POST /api/login 200 25ms "Login successful after lockout reset"
[2026-03-06 08:15:00] INFO 203.0.113.42 - GET /admin/config 403 3ms`;

interface LogInputProps {
  onAnalyze: (logs: string) => void;
  isLoading: boolean;
}

const LogInput = ({ onAnalyze, isLoading }: LogInputProps) => {
  const [logs, setLogs] = useState("");

  const handleLoadSample = () => {
    setLogs(SAMPLE_LOGS);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Log Input</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLoadSample}
          className="font-mono text-xs"
        >
          Load Sample Logs
        </Button>
      </div>
      <Textarea
        placeholder="Paste your log entries here..."
        className="min-h-[300px] font-mono text-sm bg-background border-border resize-none focus:ring-primary/50"
        value={logs}
        onChange={(e) => setLogs(e.target.value)}
      />
      <Button
        onClick={() => onAnalyze(logs)}
        disabled={!logs.trim() || isLoading}
        className="w-full glow-primary"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            <Shield className="mr-2 h-4 w-4" />
            Analyze Logs
          </>
        )}
      </Button>
    </div>
  );
};

export default LogInput;
