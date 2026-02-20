import { useEffect } from "react";

export default function MetaCallback() {
  useEffect(() => {
    if (window.opener) {
      window.close();
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-xl font-semibold">WhatsApp signup callback</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You can close this window and return to Embudex onboarding.
        </p>
      </div>
    </div>
  );
}
