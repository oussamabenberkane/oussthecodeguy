export const profile = {
  name: "Oussama Benberkane",
  handle: "@oussamabenberkane",
  role: "Software Engineer · Product Builder",
  location: "Béjaïa / Remote · UTC+1",
  email: "oussamabenberkane.pro@gmail.com",
  available: true,
  tagline:
    "I design and build performant, opinionated software — from full-stack platforms to interfaces engineered for speed and clarity.",
  social: [
    { label: "GitHub", href: "https://github.com/oussamabenberkane", handle: "github/oussamabenberkane" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/oussama-benberkane/", handle: "in/oussama-benberkane" },
    { label: "X / Twitter", href: "https://x.com/oussbytheway", handle: "x/oussbytheway" },
    { label: "Email", href: "mailto:oussamabenberkane.pro@gmail.com", handle: "oussamabenberkane.pro@gmail.com" },
  ],
};

export const sections = [
  { id: "experience", index: "01", label: "Experience" },
  { id: "projects", index: "02", label: "Projects" },
  { id: "testimonials", index: "03", label: "Testimonials" },
  { id: "about", index: "04", label: "About" },
  { id: "academic", index: "05", label: "Academic" },
  { id: "contact", index: "06", label: "Contact" },
] as const;

export type Experience = {
  company: string;
  role: string;
  start: string;
  end: string;
  location: string;
  summary: string;
  highlights: string[];
  stack: string[];
};

export const experience: Experience[] = [
  {
    company: "Wedey",
    role: "Full Stack Developer",
    start: "Jan 2026",
    end: "Present",
    location: "Remote · Full Time",
    summary:
      "Founding engineer architecting and shipping a full-stack AI-powered recruitment SaaS end to end.",
    highlights: [
      "Architecting and shipping wedey.ai — an AI-powered recruitment SaaS — as a founding engineer (Next.js 15, Supabase, PostgreSQL).",
      "Designed relational data models and the API layer for job management, skill matching, and multi-role organization dashboards.",
      "Built AI-driven candidate screening features and end-to-end flows including waitlist and interactive demo onboarding.",
    ],
    stack: ["Next.js", "TypeScript", "Supabase", "PostgreSQL", "AI"],
  },
  {
    company: "Tech-Instinct",
    role: "Backend Engineer",
    start: "Nov 2023",
    end: "Jan 2026",
    location: "Béjaïa · Full Time",
    summary:
      "Scaling a multi-frontend voting platform, leading cross-region AWS migration, and architecting backend infrastructure for invoicing.",
    highlights: [
      "Developed and optimized the Voteer platform serving 5 frontend apps with up to 100 concurrent users; reduced latency via Hazelcast distributed caching.",
      "Led AWS migration from Ireland to Paris region and built a dedicated staging environment.",
      "Designed backend architecture for the after-sales service module of FAST (invoicing app), including offline PWA functionality.",
      "Mentored a backend intern on Spring Boot, API design, and integration testing.",
    ],
    stack: ["Spring Boot", "Java", "AWS", "Hazelcast", "PWA"],
  },
  {
    company: "Abderrahmane Mira University",
    role: "Adjunct Professor",
    start: "Sept 2023",
    end: "Jan 2024",
    location: "Béjaïa · Part Time",
    summary:
      "Taught Object-Oriented Programming workshops to second-year Computer Engineering students.",
    highlights: [
      "Conducted Object-Oriented Programming workshops for 2nd-year Computer Engineering students.",
    ],
    stack: ["Java", "OOP"],
  },
  {
    company: "MSolution",
    role: "Full Stack Developer",
    start: "Jan 2023",
    end: "Nov 2023",
    location: "Béjaïa · Part Time",
    summary:
      "Built and deployed a multilingual web platform serving 1,000+ regional lawyers, end-to-end.",
    highlights: [
      "Built and deployed barreaubejaia.com for 1,000+ regional lawyers with multilingual support (Arabic, French, English).",
      "Django + SQLite backend with Bootstrap frontend; real-time announcements, council updates, and document access system.",
    ],
    stack: ["Django", "Python", "SQLite", "Bootstrap"],
  },
  {
    company: "University Hospital Center Khelil Amrane",
    role: "Data Science Intern",
    start: "May 2023",
    end: "June 2023",
    location: "Béjaïa · Internship",
    summary:
      "Trained CNNs on MRI imaging for neurosurgical decision support and shipped a Django decision-support tool.",
    highlights: [
      "Trained CNN models on 1,700 MRI images (+ augmentation) with TensorFlow, achieving 93% accuracy for neurosurgical decision prediction.",
      "Integrated the model into a Django web app as a decision-support tool for medical students.",
    ],
    stack: ["TensorFlow", "Python", "Django", "CNN"],
  },
  {
    company: "Rival School Béjaïa",
    role: "Coding Instructor",
    start: "April 2023",
    end: "June 2023",
    location: "Béjaïa · Part Time",
    summary:
      "Taught Python fundamentals and problem-solving techniques to students.",
    highlights: [
      "Taught Python fundamentals and problem-solving techniques to students.",
    ],
    stack: ["Python"],
  },
];

export type Project = {
  title: string;
  blurb: string;
  year: string;
  tags: string[];
  stack: string[];
  metric?: { label: string; value: string };
  href?: string;
  demo?: string;
  feature?: boolean;
  // Optional case-study media. Drop real assets in `/public` (e.g. `/projects/voteer.png`)
  // and reference them here; when all are absent a generated brutalist monogram poster
  // renders instead. Do NOT fabricate screenshots — leave blank until a real one exists.
  image?: string; // cover screenshot — card thumbnail + detail hero
  video?: string; // short case-study clip (mp4/webm) — takes precedence over `image`
  poster?: string; // poster frame for `video`
};

export const projects: Project[] = [
  {
    title: "Wedey",
    blurb:
      "AI-powered recruitment SaaS, built end-to-end as founding engineer. Job management, skill matching, and multi-role organization dashboards on a Next.js 15 / Supabase / PostgreSQL stack — with AI-driven candidate screening and onboarding flows from waitlist to interactive demo.",
    year: "2026",
    tags: ["Product", "AI", "SaaS"],
    stack: ["Next.js", "TypeScript", "Supabase", "PostgreSQL", "AI"],
    metric: { label: "tenants", value: "80+" },
    href: "https://wedey.ai",
    feature: true,
    video: "/projects/wedey.mp4",
    poster: "/projects/wedey-poster.jpg",
  },
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
    video: "/projects/voteer.mp4",
    poster: "/projects/voteer-poster.jpg",
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
    video: "/projects/orkestra.mp4",
    poster: "/projects/orkestra-poster.jpg",
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
  {
    title: "Barreau de Béjaïa",
    blurb:
      "Official web portal for 1,000+ regional lawyers — real-time announcements, council updates, and downloadable document forms. Multilingual (Arabic, French, English) with a responsive Bootstrap frontend.",
    year: "2023",
    tags: ["Product", "Web"],
    stack: ["Django", "Python", "SQLite", "Bootstrap"],
    metric: { label: "lawyers served", value: "1k+" },
    href: "https://barreaubejaia.com",
    video: "/projects/barreau.mp4",
    poster: "/projects/barreau-poster.jpg",
  },
  {
    title: "IDS Delivery Management",
    blurb:
      "End-to-end delivery platform for a Canadian logistics company — proof-of-delivery photos, automatic geolocation per transaction, and a management dashboard with monthly statistics and Excel export.",
    year: "2024",
    tags: ["Product", "Full-stack"],
    stack: ["Java", "Spring Boot", "PostgreSQL", "React", "React Native", "Tailwind"],
    metric: { label: "pharmacies onboarded", value: "100+" },
    href: "https://idslivraisonexpress.com",
    video: "/projects/ids.mp4",
    poster: "/projects/ids-poster.jpg",
  },
  {
    title: "MyStay",
    blurb:
      "Hotel management and guest service platform for a 5-star beachfront property in Béjaïa — three-role access (admin, staff, guest), real-time room status, and multilingual service ordering (EN/FR/AR).",
    year: "2024",
    tags: ["Product", "Web"],
    stack: ["Next.js", "TypeScript", "Supabase", "Tailwind"],
    href: "https://mystay.website",
  },
];

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  org: string;
};

export const testimonials: Testimonial[] = [
  // TODO: unverified placeholder — replace with a real testimonial; do not ship fabricated quotes
  {
    quote:
      "Ouss is the rare engineer who pairs taste with rigor. He shipped our analytics platform in a quarter — every detail considered, every regression accounted for.",
    name: "Maya Lindberg",
    role: "VP of Engineering",
    org: "Lumen Systems",
  },
  // TODO: unverified placeholder — replace with a real testimonial; do not ship fabricated quotes
  {
    quote:
      "Watching Ouss work is a masterclass. He left the codebase materially better than he found it, and our team picked up his patterns long after he moved on.",
    name: "Daniel Park",
    role: "Staff Engineer",
    org: "Nordstack",
  },
  // TODO: unverified placeholder — replace with a real testimonial; do not ship fabricated quotes
  {
    quote:
      "He treats the product like a craftsman treats wood — patient, exacting, never wasteful. Our merchant portal is the cleanest surface in the stack because of him.",
    name: "Chiara Romano",
    role: "Head of Product",
    org: "Nordstack",
  },
  // TODO: unverified placeholder — replace with a real testimonial; do not ship fabricated quotes
  {
    quote:
      "The kind of engineer founders want on day one. Pragmatic, fast, and quietly raises the bar around him without making noise about it.",
    name: "Tomás Ferreira",
    role: "Co-founder & CTO",
    org: "Cobalt Labs",
  },
];

export type Education = {
  institution: string;
  degree: string;
  start: string;
  end: string;
  grade?: string;
  thesis?: string;
  detail: string;
};

export const education: Education[] = [
  {
    institution: "Abderrahmane Mira University, Béjaïa",
    degree: "Master of Artificial Intelligence",
    start: "Sept 2021",
    end: "July 2023",
    grade: "17/20",
    thesis:
      "Deep Learning–based prediction of petrous tumour surgical approach.",
    detail:
      "Graduation: 17/20. Thesis: Deep Learning–based prediction of petrous tumour surgical approach.",
  },
  {
    institution: "Abderrahmane Mira University, Béjaïa",
    degree: "Bachelor of Computer Science",
    start: "Sept 2018",
    end: "May 2021",
    grade: "17/20",
    detail: "Graduation: 17/20.",
  },
];

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

export const values = [
  { k: "Bias for clarity", v: "Code, copy, and interfaces should reduce ambiguity, not introduce it." },
  { k: "Performance is a feature", v: "Speed earns trust. Most performance issues are design issues in disguise." },
  { k: "Ship to learn", v: "Production teaches what staging cannot. Small, observable releases beat grand reveals." },
  { k: "Craft compounds", v: "Spending an extra hour on a primitive saves a week on the things built with it." },
];
