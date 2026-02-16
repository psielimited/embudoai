import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PricingTier {
  name: string;
  price: string;
  usd?: string;
  bestFor?: string;
  limit?: string;
  includes: string[];
  restrictions?: string[];
  limitBehavior?: string[];
  cta: string;
  featured?: boolean;
}

const tiers: PricingTier[] = [
  {
    name: "Free (Freemium)",
    price: "RD$0 / month",
    bestFor: "Testing Embudex",
    limit: "200 conversations/month (hard cap)",
    includes: ["Basic AI replies", "Conversation history", "1 WhatsApp number", "1 user seat"],
    restrictions: [
      '"Powered by Embudex" shown in first outbound message',
      "No automation rules",
      "No SLA tracking",
      "No team assignment",
      "No advanced reporting",
    ],
    limitBehavior: [
      '150 conversations: "Approaching limit" notice (UI only)',
      '200 conversations: "AI pauses until upgrade" (copy only)',
    ],
    cta: "Start Free",
  },
  {
    name: "Starter",
    price: "RD$1,200 / month",
    usd: "~$20",
    limit: "Up to 500 conversations/month",
    includes: [
      "1 WhatsApp number",
      "AI auto-replies",
      "Conversation history",
      "Basic dashboard",
      "Message templates",
      "1 user seat",
    ],
    cta: "Open Dashboard",
  },
  {
    name: "Growth",
    price: "RD$2,800 / month",
    usd: "~$47",
    limit: "Up to 3,000 conversations/month",
    includes: [
      "2 user seats",
      "Lead status tracking",
      "Merchant-aware AI context",
      "Basic automation rules",
      "SLA indicators",
    ],
    cta: "Open Dashboard",
    featured: true,
  },
  {
    name: "Pro",
    price: "RD$5,500 / month",
    usd: "~$92",
    includes: [
      "Higher conversation volume",
      "Team assignment",
      "Workflow controls",
      "SLA automation",
      "Advanced reporting",
      "Multiple seats",
    ],
    cta: "Open Dashboard",
  },
];

const faqs = [
  {
    question: "What is a conversation?",
    answer: "A customer thread/session; metered per conversation thread, not per message.",
  },
  {
    question: "Does Embudex include WhatsApp fees?",
    answer: "No. WhatsApp/BSP fees are billed separately.",
  },
  {
    question: "Can I change plans anytime?",
    answer: "Yes; billing logic handled later (copy only).",
  },
  {
    question: "What happens when Free hits the limit?",
    answer: "AI pauses until upgrade; no overages on Free.",
  },
];

export default function PricingPage() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16">
      <section className="mb-10 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Pricing</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Simple, transparent plans for merchants using Embudex as a WhatsApp-first AI sales and conversation CRM layer.
          All prices are in DOP, with approximate USD references for convenience.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {tiers.map((tier) => (
          <Card
            key={tier.name}
            className={tier.featured ? "border-primary shadow-sm ring-1 ring-primary/30" : "border-border"}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">{tier.name}</CardTitle>
                  {tier.bestFor ? <CardDescription className="mt-1">Best for: {tier.bestFor}</CardDescription> : null}
                </div>
                {tier.featured ? (
                  <Badge className="inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Most popular
                  </Badge>
                ) : null}
              </div>
              <div className="pt-2">
                <p className="text-2xl font-semibold">{tier.price}</p>
                {tier.usd ? <p className="text-xs text-muted-foreground">({tier.usd} USD approx)</p> : null}
              </div>
              {tier.limit ? <p className="text-sm text-muted-foreground">{tier.limit}</p> : null}
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium">Includes</p>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {tier.includes.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {tier.restrictions?.length ? (
                <div>
                  <p className="mb-2 text-sm font-medium">Restrictions</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {tier.restrictions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {tier.limitBehavior?.length ? (
                <div>
                  <p className="mb-2 text-sm font-medium">Limit behavior</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {tier.limitBehavior.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <Button asChild className="w-full" variant={tier.featured ? "default" : "outline"}>
                <Link to="/dashboard">{tier.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-10 rounded-xl border border-border bg-muted/30 p-6">
        <h2 className="text-xl font-semibold">Add-ons and Notes</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            Overage: RD$0.75-1.25 per additional conversation beyond plan limit (meter per conversation thread, not per
            message).
          </li>
          <li>WhatsApp provider/BSP fees not included.</li>
          <li>Taxes may apply.</li>
        </ul>
      </section>

      <section className="mt-10 rounded-xl border border-border p-6">
        <h2 className="text-xl font-semibold">Why freemium?</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Reduces trust barrier for informal merchants</li>
          <li>Proves value before committing</li>
          <li>Drives adoption via watermark exposure</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">FAQ</h2>
        <div className="mt-4 space-y-2">
          {faqs.map((faq, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div key={faq.question} className="rounded-lg border border-border">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-medium">{faq.question}</span>
                  <span className="text-muted-foreground">{isOpen ? "-" : "+"}</span>
                </button>
                {isOpen ? <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground">{faq.answer}</div> : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}