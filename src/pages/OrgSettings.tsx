import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2, Building2, Users, Shield, Save, Database } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { callEdge } from "@/lib/edge";
import { useQueryClient } from "@tanstack/react-query";
import {
  useOrgs,
  useActiveOrg,
  useOrgMembers,
  useTeams,
  useOrgSettings,
  useUpdateOrg,
  useUpsertOrgSettings,
} from "@/hooks/useOrg";

const orgSettingsSchema = z
  .object({
    name: z.string().trim().min(2, "Organization name is required"),
    timezone: z.string().trim().min(1, "Timezone is required"),
    sla_first_response_minutes: z.coerce
      .number()
      .int("Must be a whole number")
      .min(1, "Must be at least 1 minute"),
    sla_next_response_minutes: z.coerce
      .number()
      .int("Must be a whole number")
      .min(1, "Must be at least 1 minute"),
  })
  .refine((value) => value.sla_next_response_minutes >= value.sla_first_response_minutes, {
    path: ["sla_next_response_minutes"],
    message: "Next response must be >= first response threshold",
  });

type OrgSettingsForm = z.infer<typeof orgSettingsSchema>;

export default function OrgSettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: activeOrgId } = useActiveOrg();
  const { data: orgs = [], isLoading } = useOrgs();
  const { data: members = [] } = useOrgMembers(activeOrgId ?? undefined);
  const { data: teams = [] } = useTeams(activeOrgId ?? undefined);
  const { data: orgSettings } = useOrgSettings(activeOrgId ?? undefined);
  const updateOrg = useUpdateOrg();
  const upsertOrgSettings = useUpsertOrgSettings();
  const [isSeeding, setIsSeeding] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isDemoPreviewing, setIsDemoPreviewing] = useState(false);
  const [isDemoResetting, setIsDemoResetting] = useState(false);

  const activeOrg = orgs.find((org) => org.id === activeOrgId);
  const isDemoOrg = /\bdemo\b/i.test(activeOrg?.name ?? "");
  const isAdminUser = useMemo(() => {
    if (!user) return false;
    const currentMembership = members.find((member) => member.user_id === user.id);
    return currentMembership?.role === "admin" || currentMembership?.role === "org_admin";
  }, [members, user]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid, isDirty },
  } = useForm<OrgSettingsForm>({
    resolver: zodResolver(orgSettingsSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      timezone: "UTC",
      sla_first_response_minutes: 15,
      sla_next_response_minutes: 60,
    },
  });

  useEffect(() => {
    if (!activeOrg || !orgSettings) return;
    reset({
      name: activeOrg.name,
      timezone: orgSettings.timezone ?? "UTC",
      sla_first_response_minutes: orgSettings.sla_first_response_minutes ?? 15,
      sla_next_response_minutes: orgSettings.sla_next_response_minutes ?? 60,
    });
  }, [activeOrg, orgSettings, reset]);

  const onSave = async (values: OrgSettingsForm) => {
    if (!activeOrgId || !activeOrg) return;

    try {
      const orgNameChanged = values.name.trim() !== activeOrg.name;

      const settingsChanged =
        values.timezone !== (orgSettings?.timezone ?? "UTC") ||
        values.sla_first_response_minutes !== (orgSettings?.sla_first_response_minutes ?? 15) ||
        values.sla_next_response_minutes !== (orgSettings?.sla_next_response_minutes ?? 60);

      if (!orgNameChanged && !settingsChanged) {
        toast.info("No changes to save");
        return;
      }

      await Promise.all([
        orgNameChanged
          ? updateOrg.mutateAsync({ org_id: activeOrgId, name: values.name.trim() })
          : Promise.resolve(),
        settingsChanged
          ? upsertOrgSettings.mutateAsync({
              org_id: activeOrgId,
              timezone: values.timezone.trim(),
              sla_first_response_minutes: values.sla_first_response_minutes,
              sla_next_response_minutes: values.sla_next_response_minutes,
            })
          : Promise.resolve(),
      ]);

      toast.success("Organization settings saved");
      reset(values);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save organization settings");
    }
  };

  const runDevSeed = async (action: "seed" | "cleanup") => {
    if (!activeOrgId) return;
    const setPending = action === "seed" ? setIsSeeding : setIsCleaning;
    setPending(true);
    try {
      const result = await callEdge<{
        ok: boolean;
        action: "seed" | "cleanup";
        conversation_id?: string;
        merchant_id?: string;
      }>("dev-validation-seed", { action });
      await queryClient.invalidateQueries();
      if (action === "seed") {
        toast.success(
          `Seed data ready${result.conversation_id ? ` (conversation ${result.conversation_id.slice(0, 8)}...)` : ""}`,
        );
      } else {
        toast.success("Seed data cleaned up");
      }
    } catch (error) {
      console.error(error);
      toast.error(`Failed to ${action} dev validation data`);
    } finally {
      setPending(false);
    }
  };

  const runDemoReset = async (action: "preview" | "reset") => {
    if (!activeOrgId) return;
    const setPending = action === "preview" ? setIsDemoPreviewing : setIsDemoResetting;
    setPending(true);
    try {
      const result = await callEdge<{
        ok: boolean;
        action: "preview" | "seed" | "cleanup" | "reset";
        org_name?: string;
        counts?: {
          merchants?: number | null;
          conversations?: number | null;
          messages?: number | null;
          opportunities?: number | null;
          tasks?: number | null;
        };
      }>("demo-reset", { action });

      if (action === "preview") {
        const c = result.counts ?? {};
        toast.success(
          `Demo snapshot: merchants=${c.merchants ?? 0}, conversations=${c.conversations ?? 0}, messages=${c.messages ?? 0}, opportunities=${c.opportunities ?? 0}, tasks=${c.tasks ?? 0}`,
        );
      } else {
        toast.success("Demo data reset complete");
      }

      await queryClient.invalidateQueries();
    } catch (error) {
      console.error(error);
      toast.error(`Failed to ${action} demo data`);
    } finally {
      setPending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Organization Settings" description="Manage org identity, timezone, and SLA defaults" />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Organization</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeOrg?.name || "-"}</div>
            <p className="text-xs text-muted-foreground mt-1">ID: {activeOrgId?.slice(0, 8)}...</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Active members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Teams</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teams.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Configured teams</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Settings</CardTitle>
          <CardDescription>Changes apply organization-wide and are used by SLA monitoring.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSave)} className="space-y-4 max-w-2xl">
            <div className="space-y-1">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input id="org-name" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" {...register("timezone")} placeholder="UTC or America/New_York" />
              {errors.timezone && <p className="text-xs text-destructive">{errors.timezone.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="sla-first">Default First Response SLA (minutes)</Label>
                <Input id="sla-first" type="number" min={1} {...register("sla_first_response_minutes")} />
                {errors.sla_first_response_minutes && (
                  <p className="text-xs text-destructive">{errors.sla_first_response_minutes.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="sla-next">Default Next Response SLA (minutes)</Label>
                <Input id="sla-next" type="number" min={1} {...register("sla_next_response_minutes")} />
                {errors.sla_next_response_minutes && (
                  <p className="text-xs text-destructive">{errors.sla_next_response_minutes.message}</p>
                )}
              </div>
            </div>

            <Button
              type="submit"
              disabled={!isValid || !isDirty || updateOrg.isPending || upsertOrgSettings.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {updateOrg.isPending || upsertOrgSettings.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isAdminUser && (
        <Card className="mt-6 border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Dev Tools
            </CardTitle>
            <CardDescription>
              Seed a complete validation fixture (merchant, conversation, opportunity, agent run, and queued outbound
              job) for quick testing without full onboarding.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={isSeeding || isCleaning}
              onClick={() => void runDevSeed("seed")}
            >
              {isSeeding ? "Seeding..." : "Seed Validation Data"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSeeding || isCleaning}
              onClick={() => void runDevSeed("cleanup")}
            >
              {isCleaning ? "Cleaning..." : "Cleanup Seed Data"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isAdminUser && isDemoOrg && (
        <Card className="mt-6 border-dashed border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Demo Mode Controls
            </CardTitle>
            <CardDescription>
              Preview demo dataset health and run a one-click reset for repeatable sales demos.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={isDemoPreviewing || isDemoResetting}
              onClick={() => void runDemoReset("preview")}
            >
              {isDemoPreviewing ? "Loading..." : "Preview Demo Data"}
            </Button>
            <Button
              type="button"
              variant="default"
              disabled={isDemoPreviewing || isDemoResetting}
              onClick={() => void runDemoReset("reset")}
            >
              {isDemoResetting ? "Resetting..." : "Reset Demo Data"}
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
