const IPS = [
  "192.168.1.10", "10.0.0.55", "172.16.0.99", "203.0.113.42",
  "192.168.1.22", "10.0.0.77", "45.33.32.156", "192.168.1.50",
];

const ENDPOINTS = [
  { path: "/api/users", method: "GET" },
  { path: "/api/login", method: "POST" },
  { path: "/api/products", method: "GET" },
  { path: "/api/dashboard", method: "GET" },
  { path: "/api/upload", method: "POST" },
  { path: "/api/orders", method: "GET" },
  { path: "/api/settings", method: "PUT" },
  { path: "/api/search", method: "GET" },
];

const SUSPICIOUS_ENTRIES = [
  { path: "/api/login", method: "POST", status: 401, msg: '"Invalid credentials"', level: "WARN" },
  { path: "/api/products?id=1 OR 1=1", method: "GET", status: 200, msg: "", level: "WARN" },
  { path: "/../../etc/passwd", method: "GET", status: 403, msg: "", level: "WARN" },
  { path: "/api/users?q=<script>alert(1)</script>", method: "GET", status: 400, msg: "", level: "WARN" },
  { path: "/admin/config", method: "GET", status: 403, msg: "", level: "WARN" },
  { path: "/api/users/ALL", method: "DELETE", status: 200, msg: "", level: "WARN" },
  { path: "/.env", method: "GET", status: 403, msg: "", level: "WARN" },
  { path: "/api/login", method: "POST", status: 401, msg: '"Brute force detected"', level: "ERROR" },
];

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function randomMs() {
  return Math.floor(Math.random() * 500) + 2;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function timestamp(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

export type LogLevel = "INFO" | "WARN" | "ERROR";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  ip: string;
  method: string;
  path: string;
  status: number;
  responseTime: number;
  message: string;
  raw: string;
  isSuspicious: boolean;
}

let counter = 0;

export function generateLogEntry(): LogEntry {
  counter++;
  const isSuspicious = Math.random() < 0.2; // 20% chance of suspicious
  const ts = timestamp();
  const ip = randomItem(IPS);
  const ms = randomMs();

  if (isSuspicious) {
    const s = randomItem(SUSPICIOUS_ENTRIES);
    const raw = `[${ts}] ${s.level} ${ip} - ${s.method} ${s.path} ${s.status} ${ms}ms${s.msg ? " " + s.msg : ""}`;
    return {
      id: `log-${counter}-${Date.now()}`,
      timestamp: ts,
      level: s.level as LogLevel,
      ip,
      method: s.method,
      path: s.path,
      status: s.status,
      responseTime: ms,
      message: s.msg,
      raw,
      isSuspicious: true,
    };
  }

  const ep = randomItem(ENDPOINTS);
  const statuses = [200, 200, 200, 200, 201, 304];
  const status = randomItem(statuses);
  const raw = `[${ts}] INFO ${ip} - ${ep.method} ${ep.path} ${status} ${ms}ms`;
  return {
    id: `log-${counter}-${Date.now()}`,
    timestamp: ts,
    level: "INFO",
    ip,
    method: ep.method,
    path: ep.path,
    status,
    responseTime: ms,
    message: "",
    raw,
    isSuspicious: false,
  };
}
