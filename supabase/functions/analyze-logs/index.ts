import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Finding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: string;
  description: string;
  evidence: string[];
  recommendation: string;
}

function analyzeLogs(logText: string) {
  const lines = logText.split("\n").filter((l) => l.trim());
  const findings: Finding[] = [];

  // --- Brute Force Detection ---
  const failedLogins: Record<string, string[]> = {};
  const ipPattern = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/;

  for (const line of lines) {
    if (/401|invalid credentials|failed.*login|authentication.*fail/i.test(line)) {
      const ipMatch = line.match(ipPattern);
      const ip = ipMatch ? ipMatch[1] : "unknown";
      if (!failedLogins[ip]) failedLogins[ip] = [];
      failedLogins[ip].push(line.trim());
    }
  }

  for (const [ip, attempts] of Object.entries(failedLogins)) {
    if (attempts.length >= 3) {
      findings.push({
        severity: attempts.length >= 5 ? "critical" : "high",
        category: "Brute Force Attack",
        description: `Detected ${attempts.length} failed login attempts from IP ${ip}. This indicates a potential brute force attack.`,
        evidence: attempts.slice(0, 5),
        recommendation:
          "Implement rate limiting, account lockout policies, and consider blocking this IP address.",
      });
    }
  }

  // --- SQL Injection Detection ---
  const sqliPatterns = [
    /OR\s+1\s*=\s*1/i,
    /UNION\s+SELECT/i,
    /;\s*DROP\s+TABLE/i,
    /'\s*OR\s+'/i,
    /--\s*$/,
    /EXEC(\s+|\()xp_/i,
  ];
  const sqliEvidence: string[] = [];
  for (const line of lines) {
    if (sqliPatterns.some((p) => p.test(line))) {
      sqliEvidence.push(line.trim());
    }
  }
  if (sqliEvidence.length > 0) {
    findings.push({
      severity: "critical",
      category: "SQL Injection Attempt",
      description: `Detected ${sqliEvidence.length} potential SQL injection attempt(s) in request parameters.`,
      evidence: sqliEvidence.slice(0, 5),
      recommendation:
        "Use parameterized queries, input validation, and a Web Application Firewall (WAF).",
    });
  }

  // --- Path Traversal Detection ---
  const traversalEvidence: string[] = [];
  for (const line of lines) {
    if (/\.\.\//g.test(line) || /\.\.\\/.test(line) || /etc\/passwd|etc\\passwd|win\.ini/i.test(line)) {
      traversalEvidence.push(line.trim());
    }
  }
  if (traversalEvidence.length > 0) {
    findings.push({
      severity: "high",
      category: "Path Traversal Attack",
      description: `Detected ${traversalEvidence.length} path traversal attempt(s) trying to access restricted files.`,
      evidence: traversalEvidence.slice(0, 5),
      recommendation:
        "Sanitize file paths, use allowlists for accessible directories, and restrict file system access.",
    });
  }

  // --- XSS Detection ---
  const xssEvidence: string[] = [];
  for (const line of lines) {
    if (/<script/i.test(line) || /javascript:/i.test(line) || /on(error|load|click)\s*=/i.test(line)) {
      xssEvidence.push(line.trim());
    }
  }
  if (xssEvidence.length > 0) {
    findings.push({
      severity: "high",
      category: "Cross-Site Scripting (XSS)",
      description: `Detected ${xssEvidence.length} potential XSS payload(s) in request parameters.`,
      evidence: xssEvidence.slice(0, 5),
      recommendation:
        "Implement Content Security Policy (CSP), sanitize user input, and encode output.",
    });
  }

  // --- Unauthorized Access Detection ---
  const unauthEvidence: string[] = [];
  for (const line of lines) {
    if (/403.*\/(admin|config|\.env|\.git)/i.test(line) || /\/admin/i.test(line) && /403/.test(line)) {
      unauthEvidence.push(line.trim());
    }
  }
  if (unauthEvidence.length > 0) {
    findings.push({
      severity: "medium",
      category: "Unauthorized Access Attempt",
      description: `Detected ${unauthEvidence.length} attempt(s) to access restricted admin/config endpoints.`,
      evidence: unauthEvidence.slice(0, 5),
      recommendation:
        "Ensure admin routes are properly secured, use IP allowlisting, and monitor access patterns.",
    });
  }

  // --- Mass Deletion Detection ---
  const massDeleteEvidence: string[] = [];
  for (const line of lines) {
    if (/DELETE.*\/(all|[\*])/i.test(line) || /DELETE.*200/i.test(line)) {
      massDeleteEvidence.push(line.trim());
    }
  }
  if (massDeleteEvidence.length > 0) {
    findings.push({
      severity: "high",
      category: "Mass Data Deletion",
      description: `Detected ${massDeleteEvidence.length} suspicious bulk delete operation(s).`,
      evidence: massDeleteEvidence.slice(0, 5),
      recommendation:
        "Implement soft deletes, require confirmation for bulk operations, and maintain audit logs.",
    });
  }

  // --- Error Spike Detection ---
  const errorLines = lines.filter((l) => /\b(500|502|503)\b/.test(l) || /\bERROR\b/i.test(l));
  if (errorLines.length >= 3) {
    findings.push({
      severity: "medium",
      category: "Error Rate Spike",
      description: `Detected ${errorLines.length} server errors which may indicate service instability or an ongoing attack.`,
      evidence: errorLines.slice(0, 5).map((l) => l.trim()),
      recommendation:
        "Investigate server health, review recent deployments, and check for resource exhaustion.",
    });
  }

  // Calculate threat level
  const suspiciousCount = findings.reduce((sum, f) => sum + f.evidence.length, 0);
  const hasCritical = findings.some((f) => f.severity === "critical");
  const hasHigh = findings.some((f) => f.severity === "high");

  let threatLevel = "Low";
  if (hasCritical) threatLevel = "Critical";
  else if (hasHigh) threatLevel = "High";
  else if (findings.length > 0) threatLevel = "Medium";

  // Sort by severity
  const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    summary: {
      total_lines: lines.length,
      suspicious_count: suspiciousCount,
      threat_level: threatLevel,
    },
    findings,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { logs } = await req.json();

    if (!logs || typeof logs !== "string" || logs.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "No log data provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (logs.length > 500000) {
      return new Response(
        JSON.stringify({ error: "Log data too large. Maximum 500KB." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = analyzeLogs(logs);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Failed to analyze logs" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
