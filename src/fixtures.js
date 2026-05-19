const fixtures = {
  "ai-support": {
    schemaVersion: "0.2",
    name: "AI support desk",
    currency: "USD",
    period: "month",
    assumptions: {
      targetGrossMargin: 0.7,
      freeMarketingBudgetPerAccount: 1.5,
      activationMoment: "First correctly resolved support question",
      pricingOwner: "monetization council",
      billingReadiness: "metered-events-ready"
    },
    unitCosts: [
      { unit: "resolution", cost: 0.18, note: "Model and retrieval cost per AI-resolved support issue" },
      { unit: "seat", cost: 0.04, note: "Workspace overhead per active support seat" }
    ],
    plans: [
      {
        name: "Free",
        model: "freemium",
        price: 0,
        accounts: 12000,
        included: { resolution: 10, seat: 1 },
        averageUsage: { resolution: 6, seat: 1 },
        conversionRate: 0.04,
        notes: "Teaches the category before asking for payment."
      },
      {
        name: "Team",
        model: "hybrid",
        price: 149,
        accounts: 900,
        included: { resolution: 250, seat: 5 },
        overage: { resolution: 0.75 },
        averageUsage: { resolution: 310, seat: 4 },
        usagePercentiles: {
          p50: { resolution: 240, seat: 4 },
          p90: { resolution: 390, seat: 5 },
          p99: { resolution: 520, seat: 5 }
        }
      },
      {
        name: "Resolution",
        model: "outcome",
        price: 0,
        accounts: 150,
        outcome: "resolved support ticket",
        measurableOutcome: true,
        finiteWorkload: true,
        included: { seat: 12 },
        overage: { resolution: 0.99 },
        averageUsage: { resolution: 1200, seat: 12 },
        usagePercentiles: {
          p50: { resolution: 900, seat: 10 },
          p90: { resolution: 1500, seat: 12 },
          p99: { resolution: 1900, seat: 12 }
        }
      }
    ]
  },
  "creative-agent": {
    schemaVersion: "0.2",
    name: "AI video creative agent",
    currency: "USD",
    period: "month",
    assumptions: {
      targetGrossMargin: 0.55,
      freeMarketingBudgetPerAccount: 3,
      activationMoment: "First usable campaign asset exported",
      pricingOwner: "growth and finance",
      billingReadiness: "basic-subscription"
    },
    unitCosts: [
      { unit: "render", cost: 0.42 },
      { unit: "image", cost: 0.08 }
    ],
    plans: [
      {
        name: "Free",
        model: "freemium",
        price: 0,
        accounts: 4000,
        included: { render: 2, image: 20 },
        averageUsage: { render: 1.6, image: 12 },
        conversionRate: 0.025
      },
      {
        name: "Creator",
        model: "credits",
        price: 110,
        accounts: 1400,
        included: { render: 40, image: 400 },
        overage: { render: 1.2, image: 0.2 },
        averageUsage: { render: 55, image: 360 },
        usagePercentiles: {
          p50: { render: 42, image: 300 },
          p90: { render: 85, image: 650 },
          p99: { render: 140, image: 1100 }
        },
        creditPolicy: {
          topups: true,
          expiryDays: 30,
          rollover: false,
          consumes: ["render", "image"]
        }
      }
    ]
  },
  "agentic-research": {
    schemaVersion: "0.2",
    name: "Agentic research workspace",
    currency: "USD",
    period: "month",
    assumptions: {
      targetGrossMargin: 0.7,
      freeMarketingBudgetPerAccount: 2,
      activationMoment: "First cited research brief accepted by a teammate",
      pricingOwner: "founder and finance",
      billingReadiness: "manual"
    },
    unitCosts: [
      { unit: "research_run", cost: 2.1, note: "Agentic research workflow with model, search, and retrieval spend" },
      { unit: "source_fetch", cost: 0.03, note: "External source fetch and processing cost" }
    ],
    plans: [
      {
        name: "Pro",
        model: "subscription",
        price: 49,
        accounts: 900,
        included: { research_run: 10, source_fetch: 200 },
        averageUsage: { research_run: 30, source_fetch: 600 },
        usagePercentiles: {
          p50: { research_run: 18, source_fetch: 400 },
          p90: { research_run: 48, source_fetch: 1000 },
          p99: { research_run: 95, source_fetch: 2200 }
        }
      },
      {
        name: "Team",
        model: "outcome",
        price: 0,
        accounts: 120,
        outcome: "accepted research brief",
        measurableOutcome: true,
        finiteWorkload: false,
        overage: { research_run: 4.5 },
        averageUsage: { research_run: 80, source_fetch: 1600 },
        usagePercentiles: {
          p50: { research_run: 60, source_fetch: 1200 },
          p90: { research_run: 140, source_fetch: 2800 },
          p99: { research_run: 260, source_fetch: 5200 }
        }
      }
    ]
  },
  "chat-copilot": {
    schemaVersion: "0.2",
    name: "Chat copilot workspace",
    currency: "USD",
    period: "month",
    assumptions: {
      targetGrossMargin: 0.72,
      freeMarketingBudgetPerAccount: 0.75,
      activationMoment: "First teammate shares a useful answer",
      pricingOwner: "self-serve lead",
      billingReadiness: "metered-events-ready"
    },
    unitCosts: [
      { unit: "message", cost: 0.012 },
      { unit: "token_1k", cost: 0.006 }
    ],
    plans: [
      {
        name: "Starter",
        model: "freemium",
        price: 0,
        accounts: 8000,
        included: { message: 25, token_1k: 30 },
        averageUsage: { message: 19, token_1k: 21 }
      },
      {
        name: "Team",
        model: "hybrid",
        price: 29,
        accounts: 2200,
        included: { message: 900, token_1k: 1200 },
        overage: { message: 0.05, token_1k: 0.02 },
        averageUsage: { message: 1040, token_1k: 1500 },
        usagePercentiles: {
          p50: { message: 700, token_1k: 900 },
          p90: { message: 1700, token_1k: 2600 },
          p99: { message: 3200, token_1k: 5200 }
        }
      }
    ]
  },
  "code-agent": {
    schemaVersion: "0.2",
    name: "Coding agent seats",
    currency: "USD",
    period: "month",
    assumptions: {
      targetGrossMargin: 0.68,
      freeMarketingBudgetPerAccount: 5,
      activationMoment: "First accepted pull request",
      pricingOwner: "founder",
      billingReadiness: "basic-subscription"
    },
    unitCosts: [
      { unit: "agent_hour", cost: 1.4 },
      { unit: "repo_scan", cost: 0.35 }
    ],
    plans: [
      {
        name: "Developer",
        model: "subscription",
        price: 39,
        accounts: 750,
        included: { agent_hour: 12, repo_scan: 6 },
        averageUsage: { agent_hour: 24, repo_scan: 12 },
        usagePercentiles: {
          p50: { agent_hour: 14, repo_scan: 8 },
          p90: { agent_hour: 42, repo_scan: 18 },
          p99: { agent_hour: 80, repo_scan: 36 }
        }
      },
      {
        name: "Team",
        model: "hybrid",
        price: 199,
        accounts: 120,
        included: { agent_hour: 80, repo_scan: 40 },
        overage: { agent_hour: 4.5 },
        averageUsage: { agent_hour: 95, repo_scan: 55 },
        usagePercentiles: {
          p50: { agent_hour: 70, repo_scan: 34 },
          p90: { agent_hour: 150, repo_scan: 75 },
          p99: { agent_hour: 260, repo_scan: 120 }
        }
      }
    ]
  },
  "data-enrichment": {
    schemaVersion: "0.2",
    name: "Data enrichment API",
    currency: "USD",
    period: "month",
    assumptions: {
      targetGrossMargin: 0.75,
      freeMarketingBudgetPerAccount: 1,
      activationMoment: "First enriched account list exported",
      pricingOwner: "growth engineering",
      billingReadiness: "metered-events-ready"
    },
    unitCosts: [
      { unit: "row_enriched", cost: 0.018 },
      { unit: "web_lookup", cost: 0.004 }
    ],
    plans: [
      {
        name: "Build",
        model: "hybrid",
        price: 149,
        accounts: 450,
        included: { row_enriched: 3000, web_lookup: 6000 },
        overage: { row_enriched: 0.09, web_lookup: 0.02 },
        averageUsage: { row_enriched: 4200, web_lookup: 7200 },
        usagePercentiles: {
          p50: { row_enriched: 2800, web_lookup: 5200 },
          p90: { row_enriched: 7200, web_lookup: 12000 },
          p99: { row_enriched: 16000, web_lookup: 26000 }
        }
      },
      {
        name: "Scale",
        model: "usage",
        price: 499,
        accounts: 90,
        included: { row_enriched: 15000, web_lookup: 30000 },
        overage: { row_enriched: 0.075, web_lookup: 0.015 },
        averageUsage: { row_enriched: 18000, web_lookup: 36000 },
        usagePercentiles: {
          p50: { row_enriched: 12000, web_lookup: 24000 },
          p90: { row_enriched: 31000, web_lookup: 62000 },
          p99: { row_enriched: 58000, web_lookup: 116000 }
        }
      }
    ]
  },
  "meeting-notes": {
    schemaVersion: "0.2",
    name: "Meeting notes assistant",
    currency: "USD",
    period: "month",
    assumptions: {
      targetGrossMargin: 0.65,
      freeMarketingBudgetPerAccount: 0.5,
      activationMoment: "First summarized meeting shared",
      pricingOwner: "product lead",
      billingReadiness: "draft"
    },
    unitCosts: [
      { unit: "meeting_hour", cost: 0.22 },
      { unit: "transcript_minute", cost: 0.006 }
    ],
    plans: [
      {
        name: "Free",
        model: "freemium",
        price: 0,
        accounts: 30000,
        included: { meeting_hour: 3, transcript_minute: 180 },
        averageUsage: { meeting_hour: 2.8, transcript_minute: 168 }
      },
      {
        name: "Pro",
        model: "subscription",
        price: 15,
        accounts: 3500,
        averageUsage: { meeting_hour: 18, transcript_minute: 1080 },
        usagePercentiles: {
          p50: { meeting_hour: 10, transcript_minute: 600 },
          p90: { meeting_hour: 35, transcript_minute: 2100 },
          p99: { meeting_hour: 70, transcript_minute: 4200 }
        }
      }
    ]
  },
  "image-api": {
    schemaVersion: "0.2",
    name: "Image generation API",
    currency: "USD",
    period: "month",
    assumptions: {
      targetGrossMargin: 0.62,
      freeMarketingBudgetPerAccount: 2,
      activationMoment: "First image used in a live asset",
      pricingOwner: "API business owner",
      billingReadiness: "metered-events-ready"
    },
    unitCosts: [
      { unit: "image", cost: 0.05 },
      { unit: "upscale", cost: 0.12 }
    ],
    plans: [
      {
        name: "Indie",
        model: "credits",
        price: 24,
        accounts: 1800,
        included: { image: 300, upscale: 30 },
        overage: { image: 0.18, upscale: 0.35 },
        averageUsage: { image: 360, upscale: 34 },
        usagePercentiles: {
          p50: { image: 240, upscale: 20 },
          p90: { image: 720, upscale: 70 },
          p99: { image: 1600, upscale: 160 }
        },
        creditPolicy: {
          topups: true,
          expiryDays: 60,
          rollover: true,
          consumes: ["image", "upscale"]
        }
      },
      {
        name: "Studio",
        model: "credits",
        price: 249,
        accounts: 220,
        included: { image: 4000, upscale: 400 },
        overage: { image: 0.16, upscale: 0.32 },
        averageUsage: { image: 4400, upscale: 390 },
        usagePercentiles: {
          p50: { image: 3200, upscale: 280 },
          p90: { image: 7200, upscale: 680 },
          p99: { image: 14000, upscale: 1300 }
        },
        creditPolicy: {
          topups: true,
          expiryDays: 60,
          rollover: true,
          consumes: ["image", "upscale"]
        }
      }
    ]
  }
};

module.exports = { fixtures };
