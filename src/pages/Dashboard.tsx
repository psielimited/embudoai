import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalyticsDaily, useSlaEvents } from "@/hooks/useReporting";
import { usePipeline } from "@/hooks/usePipeline";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, AlertTriangle, Clock, Activity, Trophy, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CHART_COLORS = [
  "hsl(234, 89%, 60%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(262, 83%, 58%)",
  "hsl(200, 80%, 50%)",
];

export default function DashboardPage() {
  const [period, setPeriod] = useState<"7" | "30">("30");
  const days = Number(period);
  const { data: analytics = [], isLoading: analyticsLoading } = useAnalyticsDaily(days);
  const { data: slaBreaches = [] } = useSlaEvents({ resolved: false });
  const { data: pipelineData } = usePipeline();

  const stages = pipelineData?.stages ?? [];

  // Live queries for current stats
  const { data: oppStats } = useQuery({
    queryKey: ["opp-stats"],
    queryFn: async () => {
      const { data: opps, error } = await supabase
        .from("opportunities")
        .select("status, stage_id, created_at, updated_at");
      if (error) throw error;
      const today = new Date().toISOString().slice(0, 10);
      const movedToday = opps?.filter(o => o.updated_at.slice(0, 10) === today).length ?? 0;
      const won = opps?.filter(o => o.status === "won").length ?? 0;
      const lost = opps?.filter(o => o.status === "lost").length ?? 0;
      const open = opps?.filter(o => o.status === "open").length ?? 0;

      // Current stage distribution
      const byStageCounts: Record<string, number> = {};
      for (const o of (opps ?? [])) {
        if (o.status === "open") {
          byStageCounts[o.stage_id] = (byStageCounts[o.stage_id] || 0) + 1;
        }
      }

      return { movedToday, won, lost, open, byStageCounts };
    },
  });

  // Aggregate analytics for charts
  const wonCount = analytics.filter(a => a.metric === "won_count").reduce((s, a) => s + Number(a.value), 0);
  const lostCount = analytics.filter(a => a.metric === "lost_count").reduce((s, a) => s + Number(a.value), 0);

  const wonLostData = [
    { name: "Won", value: wonCount || (oppStats?.won ?? 0) },
    { name: "Lost", value: lostCount || (oppStats?.lost ?? 0) },
  ];

  // Stage distribution for pie chart
  const stageDistribution = stages.map((s) => ({
    name: s.name,
    value: oppStats?.byStageCounts[s.id] ?? 0,
  })).filter(d => d.value > 0);

  // SLA breach counts by type
  const breachByType: Record<string, number> = {};
  for (const b of slaBreaches) {
    breachByType[b.sla_type] = (breachByType[b.sla_type] || 0) + 1;
  }

  if (analyticsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Dashboard" description="Pipeline analytics and SLA overview" />

      <Tabs value={period} onValueChange={(v) => setPeriod(v as "7" | "30")} className="mb-6">
        <TabsList>
          <TabsTrigger value="7">7 Days</TabsTrigger>
          <TabsTrigger value="30">30 Days</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Updated Today</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{oppStats?.movedToday ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Opportunities touched</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Won ({period}d)</CardTitle>
            <Trophy className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{wonLostData[0].value}</div>
            <p className="text-xs text-muted-foreground mt-1">Deals closed won</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lost ({period}d)</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{wonLostData[1].value}</div>
            <p className="text-xs text-muted-foreground mt-1">Deals lost</p>
          </CardContent>
        </Card>

        <Link to="/dashboard/sla">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">SLA Breaches</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">{slaBreaches.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {Object.entries(breachByType).map(([t, c]) => `${t}: ${c}`).join(", ") || "None"}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {stageDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={stageDistribution} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                    {stageDistribution.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Won vs Lost</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={wonLostData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(234, 89%, 60%)" radius={[4, 4, 0, 0]}>
                  {wonLostData.map((entry, i) => (
                    <Cell key={i} fill={i === 0 ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Open SLA breaches summary */}
      {slaBreaches.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent SLA Breaches</CardTitle>
            <Link to="/dashboard/sla" className="text-sm text-primary hover:underline">View all →</Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {slaBreaches.slice(0, 5).map((b) => (
                <div key={b.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <span className="text-sm font-medium">{b.sla_type.replace(/_/g, " ")}</span>
                    <span className="text-xs text-muted-foreground ml-2">{b.severity}</span>
                  </div>
                  <Link to={`/pipeline/opportunities/${b.entity_id}`} className="text-xs text-primary hover:underline">
                    View →
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
