import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";

const REPORTS = [
  {
    id: "funnel",
    title: "Funnel Report",
    description: "Stage entries by day — shows how opportunities flow through your pipeline.",
  },
  {
    id: "time_in_stage",
    title: "Time in Stage",
    description: "Duration each opportunity spent in every stage.",
  },
  {
    id: "rep_performance",
    title: "Rep Performance",
    description: "Daily activity counts per rep.",
  },
];

export default function Reports() {
  const [loading, setLoading] = useState<string | null>(null);

  const downloadReport = async (type: string) => {
    setLoading(type);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        toast.error("Please log in to download reports");
        return;
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-report-csv?type=${type}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${type}_report.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      toast.success("Report downloaded");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate report");
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <PageHeader title="Reports" description="Export pipeline data as CSV" />

      <div className="grid gap-4 md:grid-cols-3">
        {REPORTS.map((report) => (
          <Card key={report.id}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{report.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{report.description}</p>
              <Button
                onClick={() => downloadReport(report.id)}
                disabled={loading === report.id}
                className="w-full"
              >
                {loading === report.id ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
