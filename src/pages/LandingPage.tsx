import { MessageSquare, Bot, Languages, Database, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const features = [
  {
    title: "24/7 AI Response",
    description: "Always-on WhatsApp reply coverage for inbound customer messages.",
    icon: Bot,
  },
  {
    title: "Conversation Memory & CRM Layer",
    description: "Structured conversation history tied to leads, contacts, and opportunities.",
    icon: Database,
  },
  {
    title: "Multi-language WhatsApp Automation",
    description: "Merchant-aware flows that adapt messaging by language and operational context.",
    icon: Languages,
  },
];

const steps = [
  "Customer sends WhatsApp message",
  "Embudex responds instantly",
  "Conversation stored and visible in dashboard",
];

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <section className="rounded-2xl border border-border bg-card p-8 sm:p-12">
        <div className="max-w-3xl space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            WhatsApp-first AI CRM
          </div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Embudex</h1>
          <p className="text-xl text-muted-foreground">
            WhatsApp-first AI sales infrastructure for growing merchants.
          </p>
          <p className="text-sm text-muted-foreground sm:text-base">
            Embudex gives merchants instant WhatsApp response, structured conversation tracking, and merchant-aware AI
            replies that stay grounded in your CRM workflow.
          </p>
          <div className="pt-2">
            <Button asChild size="lg">
              <Link to="/dashboard" className="inline-flex items-center gap-2">
                Open Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title}>
            <CardHeader>
              <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <feature.icon className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="mt-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">How it works</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step} className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-xs font-semibold text-primary">Step {index + 1}</p>
                <p className="mt-1 text-sm text-foreground">{step}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
