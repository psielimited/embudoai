import { META_APP_ID } from "@/lib/meta/constants";

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: {
      init: (params: Record<string, unknown>) => void;
      login: (
        cb: (response: {
          status?: string;
          authResponse?: { code?: string };
        }) => void,
        options: Record<string, unknown>,
      ) => void;
    };
  }
}

let sdkPromise: Promise<void> | null = null;

export function loadFacebookSdk() {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    if (window.FB) {
      resolve();
      return;
    }

    window.fbAsyncInit = () => {
      window.FB?.init({
        appId: META_APP_ID,
        cookie: true,
        xfbml: false,
        version: "v24.0",
      });
      resolve();
    };

    const existing = document.getElementById("facebook-jssdk");
    if (existing) return;

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.onerror = () => reject(new Error("Failed to load Facebook SDK"));
    document.body.appendChild(script);
  });
  return sdkPromise;
}
