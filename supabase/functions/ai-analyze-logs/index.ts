import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are LogSentry AI — an expert cybersecurity threat detection engine. You analyze server/application logs to detect security threats using advanced techniques inspired by:

1. **Anomaly Detection (Isolation Forest style)**: Identify outlier patterns — unusual IPs, abnormal request rates, uncommon endpoints, weird timing patterns, atypical response codes.

2. **Autoencoder-style Pattern Recognition**: Learn the "normal" baseline from the logs and flag deviations — unexpected HTTP methods, unusual user-agents, abnormal payload sizes, irregular access patterns.

3. **Brute Force Detection**: Detect repeated failed authentication attempts from same IP, credential stuffing patterns, account enumeration attempts.

4. **Suspicious Login Analysis**: Identify impossible travel (same user from different geolocations), login at unusual hours, privilege escalation after login, session hijacking indicators.

5. **Advanced Threat Intelligence**: SQL injection, XSS, path traversal, command injection, SSRF, IDOR, API abuse, rate limit bypass, data exfiltration patterns.

Respond ONLY by calling the report_findings function with your analysis.`;

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const lines = logs.split("\n").filter((l: string) => l.trim());
    const userPrompt = `Analyze these ${lines.length} log entries for security threats:\n\n${logs}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_findings",
              description: "Report the security analysis findings from log analysis",
              parameters: {
                type: "object",
                properties: {
                  threat_level: {
                    type: "string",
                    enum: ["Critical", "High", "Medium", "Low"],
                    description: "Overall threat level based on all findings",
                  },
                  ai_summary: {
                    type: "string",
                    description: "2-3 sentence executive summary of the overall security posture observed in these logs",
                  },
                  findings: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        severity: {
                          type: "string",
                          enum: ["critical", "high", "medium", "low", "info"],
                        },
                        category: { type: "string" },
                        description: { type: "string" },
                        evidence: {
                          type: "array",
                          items: { type: "string" },
                          description: "Exact log lines or patterns that triggered this finding (max 5)",
                        },
                        recommendation: { type: "string" },
                        detection_method: {
                          type: "string",
                          enum: [
                            "anomaly_detection",
                            "pattern_recognition",
                            "brute_force_detection",
                            "suspicious_login",
                            "signature_matching",
                            "behavioral_analysis",
                          ],
                          description: "The ML/AI technique that identified this threat",
                        },
                        confidence: {
                          type: "number",
                          description: "Confidence score from 0.0 to 1.0",
                        },
                      },
                      required: ["severity", "category", "description", "evidence", "recommendation", "detection_method", "confidence"],
                      additionalProperties: false,
                    },
                  },
                  anomaly_scores: {
                    type: "object",
                    properties: {
                      ip_anomaly: { type: "number", description: "Score 0-100 for IP-based anomalies" },
                      request_anomaly: { type: "number", description: "Score 0-100 for request pattern anomalies" },
                      auth_anomaly: { type: "number", description: "Score 0-100 for authentication anomalies" },
                      payload_anomaly: { type: "number", description: "Score 0-100 for payload/input anomalies" },
                    },
                    required: ["ip_anomaly", "request_anomaly", "auth_anomaly", "payload_anomaly"],
                    additionalProperties: false,
                  },
                },
                required: ["threat_level", "ai_summary", "findings", "anomaly_scores"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_findings" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI analysis failed");
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall || toolCall.function.name !== "report_findings") {
      throw new Error("AI did not return structured findings");
    }

    const aiFindings = JSON.parse(toolCall.function.arguments);

    // Build final result compatible with existing AnalysisResult interface
    const suspiciousCount = aiFindings.findings.reduce(
      (sum: number, f: any) => sum + (f.evidence?.length || 1),
      0
    );

    const result = {
      summary: {
        total_lines: lines.length,
        suspicious_count: suspiciousCount,
        threat_level: aiFindings.threat_level,
      },
      findings: aiFindings.findings.map((f: any) => ({
        severity: f.severity,
        category: f.category,
        description: f.description,
        evidence: f.evidence?.slice(0, 5) || [],
        recommendation: f.recommendation,
        detection_method: f.detection_method,
        confidence: f.confidence,
      })),
      ai_summary: aiFindings.ai_summary,
      anomaly_scores: aiFindings.anomaly_scores,
      analysis_type: "ai",
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("AI analyze error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Failed to analyze logs with AI" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
