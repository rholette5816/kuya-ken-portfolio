export const site = {
  name: "Kuya Ken",
  fullName: "Kevin Rholette Allego",
  domain: "https://www.kradigital.site",
  title: "Kuya Ken - Kevin Rholette Allego | Full Funnel Builder — AI Systems, Automation and Meta Ads",
  description:
    "Kuya Ken builds the full funnel for product and service businesses — AI-powered systems, automation, and the Meta Ads that fill them. One builder, end to end.",
  heroImage: "/assets/kuya-ken-ai-business-systems.png",
  socialImage: "/assets/kuya-ken-kevin-rholette-allego-ai-business-systems-banner.png"
};

export type FunnelStage = {
  stage: string;
  accent: string;
  items: { title: string; body: string }[];
};

export const funnelStages: FunnelStage[] = [
  {
    stage: "Traffic",
    accent: "blue",
    items: [
      {
        title: "Meta Ads and Paid Media",
        body: "Run conversion-focused ads that send the right buyers to the right page — not just impressions, but real demand."
      }
    ]
  },
  {
    stage: "Convert",
    accent: "mint",
    items: [
      {
        title: "Sales Website and Landing Page",
        body: "Show your offer clearly and move people to action. Built to convert, not just to look good."
      },
      {
        title: "Funnel and Checkout Flow",
        body: "Guide buyers from interest to payment with the least friction possible."
      }
    ]
  },
  {
    stage: "Operate",
    accent: "lime",
    items: [
      {
        title: "POS and Order System",
        body: "Take orders, track sales, and see totals in one place instead of checking many apps and notebooks."
      },
      {
        title: "Business App and Dashboard",
        body: "Give your team one screen for tasks, inventory, bookings, customer info, and day-to-day work."
      },
      {
        title: "SaaS Product",
        body: "Build a product your users can log in to, pay for, and use every day."
      }
    ]
  },
  {
    stage: "Retain",
    accent: "amber",
    items: [
      {
        title: "Automation",
        body: "Handle repeat tasks like reminders, updates, and follow-ups automatically so your team can focus on real work."
      },
      {
        title: "AI Reports",
        body: "Turn business numbers into simple reports that tell you what is going well, what to fix, and what to do next."
      }
    ]
  }
];

export const systems = [
  {
    title: "POS and Order System",
    body: "Take orders, track sales, and see totals in one place instead of checking many apps and notebooks."
  },
  {
    title: "Business App and Dashboard",
    body: "Give your team one screen for tasks, inventory, bookings, customer info, and day-to-day work."
  },
  {
    title: "SaaS Product",
    body: "Build a product your users can log in to, pay for, and use every day."
  },
  {
    title: "Automation",
    body: "Handle repeat tasks like reminders, updates, and follow-ups automatically so your team can focus on real work."
  },
  {
    title: "Easy Reports",
    body: "Turn business numbers into simple reports that tell you what is going well and what to fix next."
  },
  {
    title: "Sales Website",
    body: "Show your offer clearly and help people take action fast."
  }
];

export const transformations = [
  ["Ads send traffic to a broken page", "Ads land on a system built to convert"],
  ["Orders are in chat", "Orders are in one dashboard"],
  ["Sales are counted by hand", "Sales are tracked live"],
  ["Customers are forgotten", "Follow-up is built in"],
  ["Ad results are hard to read", "AI reports show ROAS and next move"],
  ["Decisions are guesswork", "Reports show what to do next"]
];

export type CaseScreenshot = {
  src: string;
  alt: string;
  label: string;
  caption: string;
};

export type CaseStudy = {
  slug: string;
  name: string;
  type: string;
  url: string;
  demoVideoUrl?: string;
  demoVideoEmbedUrl?: string;
  demoVideoTitle?: string;
  signal: string;
  teaser: string;
  outcomes: string[];
  features: string[];
  screenshots: CaseScreenshot[];
  value: string;
};

export const caseStudies: CaseStudy[] = [
  {
    slug: "saiko",
    name: "Saiko Ramen & Sushi",
    type: "Restaurant Ordering and Operations System",
    url: "https://saiko-web.vercel.app/",
    demoVideoUrl: "https://youtu.be/wJ1pB55v914",
    demoVideoEmbedUrl: "https://www.youtube.com/embed/wJ1pB55v914",
    demoVideoTitle: "Saiko Project Walkthrough",
    signal:
      "Saiko helps customers order faster and helps the team manage orders with less confusion.",
    teaser:
      "Restaurant site + menu flow + admin tools in one system.",
    outcomes: [
      "Customers place orders faster",
      "Staff tracks every order clearly",
      "Daily reports are easier to review"
    ],
    features: [
      "Online menu",
      "Clear food categories",
      "Cart and checkout",
      "Mobile-friendly ordering",
      "Order tracking for customers",
      "Order management for staff",
      "Promo code support",
      "Order status updates",
      "Ready-for-pickup notifications",
      "Customer contact link",
      "Daily report tools",
      "Counter/POS-ready flow"
    ],
    screenshots: [
      {
        src: "/assets/projects/saiko/landing.jpg",
        alt: "Saiko landing page showing food ordering hero and call to action",
        label: "Landing Page",
        caption: "The customer-facing first screen for discovery and ordering."
      },
      {
        src: "/assets/projects/saiko/menu.jpg",
        alt: "Saiko menu page with food categories and ordering options",
        label: "Menu Page",
        caption: "Menu browsing, category flow, and add-to-cart ordering."
      },
      {
        src: "/assets/projects/saiko/admin.jpg",
        alt: "Saiko admin dashboard for orders and operations",
        label: "Admin Dashboard",
        caption: "Back-office controls for orders, operations, and daily workflow."
      }
    ],
    value:
      "Result: faster ordering, cleaner staff workflow, better promo control, and easier daily reporting."
  },
  {
    slug: "hinilas",
    name: "Hinilas Pro",
    type: "AI Marketing System with Admin Dashboard and Credit Engine",
    url: "https://www.hinilas.pro/home",
    demoVideoUrl: "https://youtu.be/HwdQI70hj_4",
    demoVideoEmbedUrl: "https://www.youtube.com/embed/HwdQI70hj_4",
    demoVideoTitle: "Hinilas Pro Project Walkthrough",
    signal:
      "Hinilas Pro helps business owners plan, create, and improve Meta ads with AI, then monitor real usage and results in one admin view.",
    teaser:
      "AI ad workflow from setup to analysis, with owner-level control.",
    outcomes: [
      "Teams build campaigns faster",
      "Owners see usage and revenue clearly",
      "Reports are generated in one click"
    ],
    features: [
      "Business setup flow (industry, market, language, offer)",
      "AI market research output",
      "AI marketing angle generator",
      "AI ad copy generator",
      "AI creative/image prompt support",
      "Meta ads performance analysis mode",
      "Credit-based usage engine (tiered access)",
      "Top-up request and approval workflow",
      "Campaign launch proof submission",
      "Launch verification with credit rewards",
      "Owner admin dashboard with live KPIs",
      "One-click admin report and copy/export"
    ],
    screenshots: [
      {
        src: "/assets/projects/hinilas/landing.jpg",
        alt: "Hinilas Pro landing page with AI marketing product introduction",
        label: "Landing Page",
        caption: "Public-facing page that explains the product and user entry."
      },
      {
        src: "/assets/projects/hinilas/dashboard.jpg",
        alt: "Hinilas Pro user dashboard interface for AI marketing workflow",
        label: "User Dashboard UI",
        caption: "Main workspace for setup, generation, and optimization tasks."
      },
      {
        src: "/assets/projects/hinilas/admin.jpg",
        alt: "Hinilas Pro admin dashboard with KPI and reporting modules",
        label: "Admin Dashboard",
        caption: "Owner/admin view for KPIs, usage tracking, and report controls."
      }
    ],
    value:
      "Result: faster ad production, clearer decisions, and stronger owner control over usage, revenue, and team performance."
  }
];

export const industries = [
  "Food and restaurants",
  "Service businesses",
  "Transport and logistics",
  "Ecommerce and retail",
  "Local SMEs",
  "SaaS founders"
];

export const trustProjects = [
  "Saiko Ramen & Sushi",
  "Hinilas Pro",
  "KRA Multi-brand Ecom"
];

export type ProofCard = {
  tag: string;
  headline: string;
  subline: string;
  stats: [string, string][];
  context: string;
  image?: string;
};

export const mediaResults: ProofCard[] = [
  {
    tag: "Multi-account Management",
    headline: "$4M+",
    subline: "Total ad spend managed",
    stats: [["429+", "Campaigns"], ["Multiple", "Ad accounts"], ["Active", "All markets"]],
    context: "Across eCommerce, service, and agricultural brands",
    image: "/assets/proof/proof-1.jpg"
  },
  {
    tag: "International Campaign, USA",
    headline: "10x+ ROAS",
    subline: "Return on ad spend",
    stats: [["2023", "Full year"], ["Cold traffic", "Audience"], ["Website purchases", "Goal"]],
    context: "Kynship USA account, Jan to Dec 2023",
    image: "/assets/proof/proof-4.jpg"
  },
  {
    tag: "Multi-brand PH Operator",
    headline: "176",
    subline: "Campaigns run simultaneously",
    stats: [["3.8x-5.3x", "ROAS range"], ["$8.3K", "Efficient spend"], ["COD + ecom", "Model"]],
    context: "Running parallel campaigns across different product lines",
    image: "/assets/proof/proof-7.jpg"
  },
  {
    tag: "Low Cost Per Result",
    headline: "$0.12",
    subline: "Cost per result",
    stats: [["9.84%", "Avg CTR"], ["Website purchases", "Objective"], ["Jan-Dec 2023", "Period"]],
    context: "Consistent low CPR across test campaigns",
    image: "/assets/proof/proof-8.jpg"
  },
  {
    tag: "Agricultural Product, Cold Traffic",
    headline: "4x ROAS",
    subline: "Return on cold traffic",
    stats: [["$8.3K", "Total spend"], ["41 campaigns", "Tested"], ["$2.71", "CPM"]],
    context: "Lakatan banana bulb, Philippine cold traffic",
    image: "/assets/proof/proof-2.jpg"
  }
];

export type FeedbackVideo = {
  src: string;
  label: string;
};

export const feedbackVideos: FeedbackVideo[] = [
  {
    src: "https://statics.pancake.vn/web-media/b9/35/f8/a5/c95de6ed6f80c36a3519345b64051da6672f044c6e8e397a500224a7-w:1280-h:720-l:8081424-t:video/mp4.mp4",
    label: "eCommerce Client"
  },
  {
    src: "https://statics.pancake.vn/web-media/98/c0/0d/28/54500fbf49f6dc3175c07041b862093d429499e45d85cbdf07204e4d-w:1440-h:900-l:36512776-t:video/mp4.mp4",
    label: "Brand Partner"
  },
  {
    src: "https://statics.pancake.vn/web-media/30/e8/03/49/15de71b02b303d39cf92c06037a2ffbb0dbc65b60675ac65180d4c2e-w:1280-h:720-l:73154462-t:video/mp4.mp4",
    label: "Service Business"
  }
];

export const processSteps = [
  {
    number: "01",
    accent: "blue",
    name: "Audit",
    body: "We map the full funnel, ads, landing page, system, and follow-up, and find where the biggest leak is."
  },
  {
    number: "02",
    accent: "mint",
    name: "Plan",
    body: "We pick the right first move. Build the system first, run ads first, or fix both together, based on what your business actually needs."
  },
  {
    number: "03",
    accent: "lime",
    name: "Build",
    body: "I build the system and set up the ads. Everything is designed to work together from day one."
  },
  {
    number: "04",
    accent: "amber",
    name: "Launch and Optimize",
    body: "We go live, track results, and improve based on real data, not guesswork."
  }
];
