import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, UserCheck, XCircle, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLead, useConvertLead, useDisqualifyLead } from "@/hooks/useLeads";
import { usePipeline } from "@/hooks/usePipeline";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

export default function LeadDetail() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const { data: lead, isLoading } = useLead(leadId);
  const { data: pipelineData } = usePipeline();
  const convertLead = useConvertLead();
  const disqualifyLead = useDisqualifyLead();

  const [convertOpen, setConvertOpen] = useState(false);
  const [createOpp, setCreateOpp] = useState(false);
  const [selectedStage, setSelectedStage] = useState("");

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!lead) return <p className="text-muted-foreground">Lead not found</p>;

  const phones = (Array.isArray(lead.phones) ? lead.phones : []) as string[];
  const emails = (Array.isArray(lead.emails) ? lead.emails : []) as string[];
  const tags = (Array.isArray(lead.tags) ? lead.tags : []) as string[];

  const handleConvert = async () => {
    try {
      const payload: any = { lead_id: lead.id };
      if (createOpp && pipelineData?.pipeline) {
        payload.create_opportunity = true;
        payload.pipeline_id = pipelineData.pipeline.id;
        payload.initial_stage_id = selectedStage || pipelineData.stages[0]?.id;
      }
      const result = await convertLead.mutateAsync(payload);
      toast({ title: result.merged ? "Lead merged into existing contact" : "Lead converted to contact" });
      setConvertOpen(false);
      navigate("/contacts");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDisqualify = async () => {
    try {
      await disqualifyLead.mutateAsync(lead.id);
      toast({ title: "Lead disqualified" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <>
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/leads")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Leads
        </Button>
      </div>

      <PageHeader
        title={lead.full_name}
        description={`Source: ${lead.source} · Status: ${lead.status}`}
        actions={lead.status === "open" ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDisqualify} disabled={disqualifyLead.isPending}>
              <XCircle className="h-4 w-4 mr-1" /> Disqualify
            </Button>
            <Button onClick={() => setConvertOpen(true)}>
              <UserCheck className="h-4 w-4 mr-1" /> Convert to Contact
            </Button>
          </div>
        ) : undefined}
      />

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="outline">{lead.status}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phones</span>
              <span>{phones.length > 0 ? phones.join(", ") : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Emails</span>
              <span>{emails.length > 0 ? emails.join(", ") : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{format(new Date(lead.created_at), "MMM d, yyyy HH:mm")}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Tags & UTM</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Tags:</span>
              <div className="flex gap-1 mt-1 flex-wrap">
                {tags.length > 0 ? tags.map((t, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>
                )) : <span className="text-muted-foreground">None</span>}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">UTM:</span>
              <pre className="text-xs mt-1 bg-muted p-2 rounded">
                {JSON.stringify(lead.utm, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert Lead to Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will create (or merge into) a contact record for <strong>{lead.full_name}</strong>.
            </p>
            <div className="flex items-center gap-3">
              <Switch checked={createOpp} onCheckedChange={setCreateOpp} />
              <Label>Also create an opportunity</Label>
            </div>
            {createOpp && pipelineData && (
              <div>
                <Label>Initial Stage</Label>
                <Select value={selectedStage} onValueChange={setSelectedStage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelineData.stages.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertOpen(false)}>Cancel</Button>
            <Button onClick={handleConvert} disabled={convertLead.isPending}>
              {convertLead.isPending ? "Converting…" : "Convert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
