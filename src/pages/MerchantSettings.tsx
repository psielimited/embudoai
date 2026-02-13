import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Store, Save, Eye, EyeOff } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useMerchant } from "@/hooks/useMerchants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function MerchantSettings() {
  const { merchantId } = useParams<{ merchantId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: merchant, isLoading } = useMerchant(merchantId!);

  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize form values once merchant loads
  if (merchant && !initialized) {
    setPhoneNumberId(merchant.whatsapp_phone_number_id ?? "");
    setVerifyToken(merchant.whatsapp_verify_token ?? "");
    setAppSecret(merchant.whatsapp_app_secret ?? "");
    setInitialized(true);
  }

  const handleSave = async () => {
    if (!merchantId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("merchants")
        .update({
          whatsapp_phone_number_id: phoneNumberId || null,
          whatsapp_verify_token: verifyToken || null,
          whatsapp_app_secret: appSecret || null,
        })
        .eq("id", merchantId);

      if (error) throw error;
      toast.success("WhatsApp settings saved");
      queryClient.invalidateQueries({ queryKey: ["merchant", merchantId] });
    } catch (e) {
      toast.error("Failed to save settings");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={`${merchant?.name ?? "Merchant"} Settings`}
        breadcrumbs={[
          { label: "Merchants", href: "/merchants" },
          { label: merchant?.name ?? "...", href: `/merchants/${merchantId}/conversations` },
          { label: "Settings" },
        ]}
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              WhatsApp Cloud API
            </CardTitle>
            <CardDescription>
              Configure the WhatsApp Business API connection for this merchant.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={webhookUrl} className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    toast.success("Copied to clipboard");
                  }}
                >
                  Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Paste this URL in your Meta App's webhook configuration.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumberId">Phone Number ID</Label>
              <Input
                id="phoneNumberId"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                placeholder="e.g. 123456789012345"
              />
              <p className="text-xs text-muted-foreground">
                From Meta Business Suite → WhatsApp → Phone Numbers.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verifyToken">Verify Token</Label>
              <Input
                id="verifyToken"
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                placeholder="Choose a secret token for webhook verification"
              />
              <p className="text-xs text-muted-foreground">
                Must match the token you set in Meta's webhook configuration.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="appSecret">App Secret (recommended)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="appSecret"
                  type={showSecret ? "text" : "password"}
                  value={appSecret}
                  onChange={(e) => setAppSecret(e.target.value)}
                  placeholder="Meta App Secret for signature verification"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enables X-Hub-Signature-256 verification. Found in Meta App → Settings → Basic → App Secret.
              </p>
            </div>

            <Button onClick={handleSave} disabled={saving} className="mt-2">
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving…" : "Save Settings"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
