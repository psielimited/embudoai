import { Store, MessageSquare, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { useMerchants } from "@/hooks/useMerchants";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const { data: merchants = [] } = useMerchants();
  
  const { data: conversationStats } = useQuery({
    queryKey: ["conversation-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("status");
      
      if (error) throw error;
      
      const open = data.filter(c => c.status === "open").length;
      const needsHandoff = data.filter(c => c.status === "needs_handoff").length;
      
      return { total: data.length, open, needsHandoff };
    },
  });

  const stats = [
    {
      title: "Total Merchants",
      value: merchants.length,
      description: `${merchants.filter(m => m.status === 'active').length} active`,
      icon: Store,
      href: "/merchants",
    },
    {
      title: "Open Conversations",
      value: conversationStats?.open ?? 0,
      description: "Across all merchants",
      icon: MessageSquare,
    },
    {
      title: "Needs Handoff",
      value: conversationStats?.needsHandoff ?? 0,
      description: "Requires human attention",
      icon: AlertCircle,
    },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of your EmbudoAI workspace"
      />
      
      <div className="grid gap-6 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            {stat.href ? (
              <Link to={stat.href}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                </CardContent>
              </Link>
            ) : (
              <>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                </CardContent>
              </>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
