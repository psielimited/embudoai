import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Eye, EyeOff, Save, Store } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useDeactivateMerchant, useMerchant, useUpdateMerchant } from "@/hooks/useMerchants";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function MerchantSettings() {
  const { merchantId } = useParams<{ merchantId: string }>();
  const navigate = useNavigate();
  const { data: merchant, isLoading } = useMerchant(merchantId!);
  const updateMerchant = useUpdateMerchant();
  const deactivateMerchant = useDeactivateMerchant();

  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!merchant || initialized) return;
    setPhoneNumberId(merchant.whatsapp_phone_number_id ?? "");
    setVerifyToken(merchant.whatsapp_verify_token ?? "");
    setAppSecret(merchant.whatsapp_app_secret ?? "");
    setAccessToken(merchant.whatsapp_access_token ?? "");
    setInitialized(true);
  }, [merchant, initialized]);

  const handleSave = async () => {
    if (!merchantId) return;
    try {
      await updateMerchant.mutateAsync({
        id: merchantId,
        updates: {
          whatsapp_phone_number_id: phoneNumberId || null,
          whatsapp_verify_token: verifyToken || null,
          whatsapp_app_secret: appSecret || null,
          whatsapp_access_token: accessToken || null,
        },
      });
      toast.success("WhatsApp settings saved");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save settings");
    }
  };

  const handleStatusToggle = async (checked: boolean) => {
    if (!merchantId) return;
    const nextStatus = checked ? "active" : "inactive";
    try {
      await updateMerchant.mutateAsync({
        id: merchantId,
        updates: { status: nextStatus },
      });
      toast.success(`Merchant marked ${nextStatus}`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update merchant status");
    }
  };

  const handleDeactivate = async () => {
    if (!merchantId) return;
    try {
      await deactivateMerchant.mutateAsync(merchantId);
      toast.success("Merchant archived");
    } catch (error) {
      console.error(error);
      toast.error("Failed to archive merchant");
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
        {merchant?.status === "inactive" && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Inactive merchant</AlertTitle>
            <AlertDescription>
              This merchant is archived. Conversations and workflows should be treated as read-only until reactivated.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Merchant Status</CardTitle>
            <CardDescription>Toggle whether this merchant is active in your workspace.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">{merchant?.status === "active" ? "Active" : "Inactive"}</p>
              <p className="text-sm text-muted-foreground">
                Inactive merchants are hidden by default from merchant list views.
              </p>
            </div>
            <Switch
              checked={merchant?.status === "active"}
              onCheckedChange={handleStatusToggle}
              disabled={updateMerchant.isPending || deactivateMerchant.isPending}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              WhatsApp Cloud API
            </CardTitle>
            <CardDescription>Configure the WhatsApp Business API connection for this merchant.</CardDescription>
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
                Paste this URL in your Meta App webhook configuration.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumberId">Phone Number ID</Label>
              <Input
                id="phoneNumberId"
                value={phoneNumberId}
                onChange={(event) => setPhoneNumberId(event.target.value)}
                placeholder="e.g. 123456789012345"
              />
              <p className="text-xs text-muted-foreground">From Meta Business Suite to WhatsApp to Phone Numbers.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verifyToken">Verify Token</Label>
              <Input
                id="verifyToken"
                value={verifyToken}
                onChange={(event) => setVerifyToken(event.target.value)}
                placeholder="Choose a secret token for webhook verification"
              />
              <p className="text-xs text-muted-foreground">
                Must match the token you set in Meta webhook configuration.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="appSecret">App Secret (recommended)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="appSecret"
                  type={showSecret ? "text" : "password"}
                  value={appSecret}
                  onChange={(event) => setAppSecret(event.target.value)}
                  placeholder="Meta App Secret for signature verification"
                />
                <Button variant="ghost" size="icon" onClick={() => setShowSecret((value) => !value)}>
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enables X-Hub-Signature-256 verification in the webhook.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accessToken">Access Token (required for sending)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="accessToken"
                  type={showToken ? "text" : "password"}
                  value={accessToken}
                  onChange={(event) => setAccessToken(event.target.value)}
                  placeholder="Permanent or temporary access token"
                />
                <Button variant="ghost" size="icon" onClick={() => setShowToken((value) => !value)}>
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Required for outbound messages from this merchant configuration.
              </p>
            </div>

            <Button
              onClick={handleSave}
              disabled={updateMerchant.isPending || deactivateMerchant.isPending}
              className="mt-2"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateMerchant.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>Archive this merchant. You can reactivate later from the status toggle.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Archiving hides this merchant from default list views and marks it inactive.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={merchant?.status === "inactive" || deactivateMerchant.isPending}>
                  Deactivate Merchant
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Deactivate {merchant?.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will archive the merchant and remove it from active lists until reactivated.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => void handleDeactivate()}
                  >
                    Confirm Deactivate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <div>
          <Button variant="outline" onClick={() => navigate(`/merchants/${merchantId}/conversations`)}>
            Back to Conversations
          </Button>
        </div>
      </div>
    </>
  );
}
