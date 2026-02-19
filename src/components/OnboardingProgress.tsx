import { Badge } from "@/components/ui/badge";

type OnboardingProgressProps = {
  activeStep: number;
  stepLabels: string[];
  helperText?: string;
};

export function OnboardingProgress({ activeStep, stepLabels, helperText }: OnboardingProgressProps) {
  const clampedStep = Math.min(Math.max(activeStep, 1), stepLabels.length);
  const percent = Math.round((clampedStep / stepLabels.length) * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Onboarding progress</span>
        <span>{percent}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-primary transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {stepLabels.map((label, index) => (
          <Badge key={label} variant={index + 1 <= clampedStep ? "secondary" : "outline"}>
            {index + 1}. {label}
          </Badge>
        ))}
        {helperText ? <span className="text-xs text-muted-foreground">{helperText}</span> : null}
      </div>
    </div>
  );
}
