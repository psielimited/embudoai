import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { callEdge } from "@/lib/edge";
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
      const blob = await callEdge<Blob>(`generate-report-csv?type=${encodeURIComponent(type)}`, undefined);
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
