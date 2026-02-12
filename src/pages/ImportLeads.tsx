import { useState, useRef } from "react";
import { format } from "date-fns";
import { Upload, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useImportJobs, useStartImport, useDownloadErrorReport } from "@/hooks/useImportJobs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const LEAD_FIELDS = ["full_name", "phone", "email", "source"];

export default function ImportLeads() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [filePath, setFilePath] = useState<string | null>(null);

  const { data: jobs = [], isLoading } = useImportJobs();
  const startImport = useStartImport();
  const downloadError = useDownloadErrorReport();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Read headers
    const text = await file.text();
    const firstLine = text.split(/\r?\n/)[0];
    const headers = firstLine.split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    setCsvHeaders(headers);

    // Auto-map
    const autoMap: Record<string, string> = {};
    for (const field of LEAD_FIELDS) {
      const match = headers.find(h =>
        h.toLowerCase().includes(field.replace("_", " ")) ||
        h.toLowerCase().includes(field.replace("_", ""))
      );
      if (match) autoMap[field] = match;
    }
    setMapping(autoMap);

    // Upload file
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("imports").upload(path, file);
      if (error) throw error;
      setFilePath(path);
      toast({ title: "File uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleStartImport = async () => {
    if (!filePath) return;
    try {
      await startImport.mutateAsync({ file_path: filePath, mapping });
      toast({ title: "Import job started" });
      setCsvHeaders([]);
      setMapping({});
      setFilePath(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const statusColor = (status: string) => {
    const m: Record<string, string> = {
      queued: "bg-muted text-muted-foreground",
      running: "bg-primary/10 text-primary border-primary/20",
      completed: "bg-status-active/10 text-status-active border-status-active/20",
      failed: "bg-destructive/10 text-destructive border-destructive/20",
    };
    return m[status] || "";
  };

  return (
    <>
      <PageHeader
        title="Import Leads"
        description="Upload CSV files to bulk-import leads"
        breadcrumbs={[{ label: "Leads", href: "/leads" }, { label: "Import" }]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload Section */}
        <Card>
          <CardHeader><CardTitle className="text-base">Upload CSV</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full"
            >
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {filePath ? "File uploaded ✓" : "Select CSV File"}
            </Button>

            {csvHeaders.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Map columns to lead fields:</p>
                {LEAD_FIELDS.map(field => (
                  <div key={field} className="flex items-center gap-2">
                    <Label className="w-24 text-xs capitalize">{field.replace("_", " ")}</Label>
                    <Select
                      value={mapping[field] || ""}
                      onValueChange={(v) => setMapping(m => ({ ...m, [field]: v }))}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {csvHeaders.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}

                <Button
                  className="w-full"
                  onClick={handleStartImport}
                  disabled={!mapping.full_name || startImport.isPending}
                >
                  {startImport.isPending ? "Starting…" : "Start Import"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Job History */}
        <Card>
          <CardHeader><CardTitle className="text-base">Import History</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No imports yet</p>
            ) : (
              <ul className="space-y-3">
                {jobs.map(job => {
                  const stats = (job.stats as any) || {};
                  return (
                    <li key={job.id} className="flex items-start justify-between border-b border-border pb-2 last:border-0">
                      <div className="text-sm">
                        <Badge variant="outline" className={statusColor(job.status)}>
                          {job.status}
                        </Badge>
                        <p className="mt-1 text-muted-foreground text-xs">
                          {format(new Date(job.created_at), "MMM d, yyyy HH:mm")}
                        </p>
                        {job.status === "completed" && (
                          <p className="text-xs mt-1">
                            {stats.inserted || 0} inserted · {stats.duplicates || 0} dupes · {stats.errors || 0} errors
                          </p>
                        )}
                      </div>
                      {job.error_report_path && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => downloadError.mutate(job.error_report_path!)}
                        >
                          <Download className="h-3 w-3 mr-1" /> Errors
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
