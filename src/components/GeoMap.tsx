import { useState, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe, MapPin, Search, RefreshCw, AlertTriangle, Shield, Crosshair } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import "leaflet/dist/leaflet.css";

interface GeoData {
  ip: string;
  city: string;
  region: string;
  country_name: string;
  country_code: string;
  latitude: number;
  longitude: number;
  org: string;
  threat_score: number;
  attack_count: number;
}

// Pre-populated suspicious IPs for demo
const DEMO_IPS = [
  "185.220.101.1",
  "45.155.205.233",
  "194.26.192.64",
  "103.145.13.42",
  "91.240.118.172",
  "223.171.91.140",
  "5.188.210.101",
  "185.56.83.83",
];

function getRiskColor(score: number): string {
  if (score >= 80) return "hsl(0, 72%, 55%)";
  if (score >= 60) return "hsl(25, 90%, 55%)";
  if (score >= 40) return "hsl(38, 92%, 55%)";
  return "hsl(174, 72%, 50%)";
}

function getRiskLabel(score: number): string {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

function getRiskBadgeVariant(score: number): "destructive" | "default" | "secondary" | "outline" {
  if (score >= 60) return "destructive";
  if (score >= 40) return "default";
  return "secondary";
}

// Component to fit bounds
function FitBounds({ markers }: { markers: GeoData[] }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length > 0) {
      const bounds = markers.map((m) => [m.latitude, m.longitude] as [number, number]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 5 });
    }
  }, [markers, map]);
  return null;
}

const GeoMap = () => {
  const [geoData, setGeoData] = useState<GeoData[]>([]);
  const [loading, setLoading] = useState(false);
  const [customIp, setCustomIp] = useState("");
  const { toast } = useToast();

  const lookupIP = useCallback(async (ip: string): Promise<GeoData | null> => {
    try {
      const res = await fetch(`https://ipapi.co/${ip}/json/`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.error) return null;
      return {
        ip,
        city: data.city || "Unknown",
        region: data.region || "",
        country_name: data.country_name || "Unknown",
        country_code: data.country_code || "",
        latitude: data.latitude || 0,
        longitude: data.longitude || 0,
        org: data.org || "Unknown",
        threat_score: Math.floor(Math.random() * 60) + 40,
        attack_count: Math.floor(Math.random() * 20) + 1,
      };
    } catch {
      return null;
    }
  }, []);

  const loadDemoData = useCallback(async () => {
    setLoading(true);
    const results: GeoData[] = [];
    // Batch with small delays to avoid rate limiting
    for (const ip of DEMO_IPS) {
      const result = await lookupIP(ip);
      if (result) results.push(result);
      // Small delay to avoid rate limiting on free API
      await new Promise((r) => setTimeout(r, 600));
    }
    setGeoData(results);
    setLoading(false);
    toast({ title: `Loaded ${results.length} IP locations` });
  }, [lookupIP, toast]);

  const handleAddIP = async () => {
    const ip = customIp.trim();
    if (!ip) return;
    if (geoData.find((g) => g.ip === ip)) {
      toast({ title: "IP already on map", variant: "destructive" });
      return;
    }
    setLoading(true);
    const result = await lookupIP(ip);
    if (result) {
      setGeoData((prev) => [...prev, result]);
      setCustomIp("");
      toast({ title: `Located ${ip}`, description: `${result.city}, ${result.country_name}` });
    } else {
      toast({ title: "Lookup failed", description: "Could not resolve IP", variant: "destructive" });
    }
    setLoading(false);
  };

  // Country aggregation
  const countryCounts = geoData.reduce<Record<string, { count: number; attacks: number }>>((acc, g) => {
    if (!acc[g.country_name]) acc[g.country_name] = { count: 0, attacks: 0 };
    acc[g.country_name].count++;
    acc[g.country_name].attacks += g.attack_count;
    return acc;
  }, {});

  const sortedCountries = Object.entries(countryCounts).sort((a, b) => b[1].attacks - a[1].attacks);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Enter IP address (e.g. 8.8.8.8)"
              value={customIp}
              onChange={(e) => setCustomIp(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddIP()}
              className="pl-10 bg-card border-border font-mono-code"
            />
          </div>
          <Button onClick={handleAddIP} disabled={loading} variant="outline" className="gap-1.5">
            <Crosshair className="h-4 w-4" />
            Locate
          </Button>
        </div>
        <Button onClick={loadDemoData} disabled={loading} className="gap-1.5">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Scanning..." : "Load Demo Threats"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <Card className="lg:col-span-2 border-border bg-card overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              Threat Geolocation Map
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[420px] w-full relative">
              <MapContainer
                center={[20, 0]}
                zoom={2}
                scrollWheelZoom={true}
                className="h-full w-full z-0"
                style={{ background: "hsl(220, 20%, 7%)" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                {geoData.map((g) => (
                  <CircleMarker
                    key={g.ip}
                    center={[g.latitude, g.longitude]}
                    radius={Math.min(g.attack_count * 2 + 6, 25)}
                    pathOptions={{
                      color: getRiskColor(g.threat_score),
                      fillColor: getRiskColor(g.threat_score),
                      fillOpacity: 0.6,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <div className="text-xs space-y-1 min-w-[180px]" style={{ color: "#222" }}>
                        <div className="font-bold text-sm">{g.ip}</div>
                        <div>📍 {g.city}, {g.country_name}</div>
                        <div>🏢 {g.org}</div>
                        <div>⚠️ Risk Score: <strong>{g.threat_score}/100</strong> ({getRiskLabel(g.threat_score)})</div>
                        <div>🔥 Attacks: <strong>{g.attack_count}</strong></div>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
                {geoData.length > 0 && <FitBounds markers={geoData} />}
              </MapContainer>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar - Country breakdown & IP list */}
        <div className="space-y-4">
          {/* Country Breakdown */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-accent" />
                Attacks by Country
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sortedCountries.length === 0 ? (
                <p className="text-xs text-muted-foreground">No data yet. Load demo threats or add an IP.</p>
              ) : (
                sortedCountries.map(([country, data]) => (
                  <div key={country} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <span className="text-sm">{country}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{data.count} IPs</span>
                      <Badge variant="outline" className="font-mono-code text-xs">
                        {data.attacks} attacks
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* IP List */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Tracked IPs ({geoData.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {geoData.length === 0 ? (
                <p className="text-xs text-muted-foreground">No IPs tracked yet.</p>
              ) : (
                geoData.map((g) => (
                  <div key={g.ip} className="flex items-center justify-between py-1 text-xs">
                    <div className="flex items-center gap-2">
                      <AlertTriangle
                        className="h-3 w-3"
                        style={{ color: getRiskColor(g.threat_score) }}
                      />
                      <span className="font-mono-code">{g.ip}</span>
                    </div>
                    <Badge variant={getRiskBadgeVariant(g.threat_score)} className="text-[10px] px-1.5">
                      {getRiskLabel(g.threat_score)}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default GeoMap;
