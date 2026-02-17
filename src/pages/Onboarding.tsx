import { useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useMerchants } from "@/hooks/useMerchants";

export default function Onboarding() {
  const navigate = useNavigate();
  const { data: merchants = [], isLoading } = useMerchants();

  useEffect(() => {
    if (isLoading) return;
    if (merchants.length > 0) {
      navigate(`/merchants/${merchants[0].id}/settings`, { replace: true });
      return;
    }
    navigate("/merchants", { replace: true });
  }, [isLoading, merchants, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return <Navigate to="/merchants" replace />;
}
