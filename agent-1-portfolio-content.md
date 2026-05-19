# Agent Task: Migrate Real Portfolio Content

## Context

You are working inside `/home/ouss/Desktop/Coding/OussPortfolio`.

The file `src/lib/portfolio.ts` currently contains **fake placeholder data** (made-up projects, invented GitHub stats). Your job is to replace those with real content from the developer's actual work history. All real source data is included below — do not try to infer missing fields or read from the old portfolio.

## What to change

### 1. Replace the `projects` array

Locate `export const projects: Project[] = [` and replace the **entire array** with:

```typescript
export const projects: Project[] = [
  {
    title: "Voteer Platform",
    blurb:
      "Scalable backend powering 5 frontend apps with real-time voting, distributed caching, and 100+ concurrent users. Led an AWS cross-region migration (Ireland → Paris) and built a dedicated staging environment from scratch.",
    year: "2024",
    tags: ["Product", "Backend"],
    stack: ["Java", "Spring Boot", "PostgreSQL", "AWS", "Hazelcast"],
    metric: { label: "concurrent users", value: "100+" },
    href: "https://voteer.com",
    feature: true,
  },
  {
    title: "Orkestra",
    blurb:
      "Unified BI cockpit for Swiss insurance brokers — consolidates BrokerStar and Odoo into one operational surface. AI agents handle renewals, overdue payments, and nightly report generation with Swiss data-sovereignty compliance (LPD Art. 16).",
    year: "2025",
    tags: ["Product", "AI", "B2B"],
    stack: ["Next.js", "TypeScript", "Mistral", "Odoo", "BrokerStar", "Infomaniak"],
    metric: { label: "data sync", value: "every 3 min" },
    href: "https://orkestra-cockpit.vercel.app",
    feature: true,
  },
  {
    title: "IDS Delivery Management",
    blurb:
      "End-to-end delivery platform for a Canadian logistics company — proof-of-delivery photos, automatic geolocation per transaction, and a management dashboard with monthly statistics and Excel export.",
    year: "2024",
    tags: ["Product", "Full-stack"],
    stack: ["Java", "Spring Boot", "PostgreSQL", "React", "React Native", "Tailwind"],
    metric: { label: "pharmacies onboarded", value: "50+" },
    href: "https://idslivraisonexpress.com",
  },
  {
    title: "MyStay",
    blurb:
      "Hotel management and guest service platform for a 5-star beachfront property in Béjaïa — three-role access (admin, staff, guest), real-time room status, and multilingual service ordering (EN/FR/AR).",
    year: "2024",
    tags: ["Product", "Web"],
    stack: ["Next.js", "TypeScript", "Node.js", "PostgreSQL"],
    href: "https://mystay.website",
  },
  {
    title: "Barreau de Béjaïa",
    blurb:
      "Official web portal for 1,000+ regional lawyers — real-time announcements, council updates, and downloadable document forms. Multilingual (Arabic, French, English) with a responsive Bootstrap frontend.",
    year: "2023",
    tags: ["Product", "Web"],
    stack: ["Django", "Python", "SQLite", "Bootstrap"],
    metric: { label: "lawyers served", value: "1k+" },
    href: "https://barreaubejaia.com",
  },
  {
    title: "Esprit Livre",
    blurb:
      "Mobile-first bookstore platform for an Algerian retailer — full catalog browsing, search, filters, secure checkout, and an admin panel for books, orders, and analytics. Multilingual (FR/EN/AR) with full RTL support.",
    year: "2024",
    tags: ["Product", "E-commerce"],
    stack: ["Java", "Spring Boot", "PostgreSQL", "React", "Tailwind"],
    href: "https://espritlivre.com",
  },
];
```

### 2. Replace the global `stack` array

Locate `export const stack = [` and replace the **entire array** with the developer's real tech stack (removing aspirational/fictional items like Go, Rust, ClickHouse, Kafka):

```typescript
export const stack = [
  "Java",
  "Spring Boot",
  "TypeScript",
  "React",
  "Next.js",
  "Python",
  "Django",
  "Node",
  "PostgreSQL",
  "AWS",
  "Docker",
  "Tailwind",
  "Framer Motion",
];
```

## What NOT to touch

- The `profile` object
- The `sections` array
- The `Experience` type and `experience` array
- The `Testimonial` type and `testimonials` array (left as placeholder on purpose)
- The `Education` type and `education` array
- The `values` array
- All TypeScript type definitions

## Steps

1. Read `src/lib/portfolio.ts`
2. Replace the `projects` array using the Edit tool — target from `export const projects: Project[] = [` to the closing `];` of that array
3. Replace the `stack` array using the Edit tool — target from `export const stack = [` to its closing `];`
4. Run `npm run build` from the project root to verify no TypeScript errors were introduced
5. Fix any errors if they appear (do not change project data, only fix syntax)
