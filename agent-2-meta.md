# Agent Task: Update Portfolio Metadata

## Context

You are working inside `/home/ouss/Desktop/Coding/OussPortfolio`.

The file `src/app/layout.tsx` contains SEO and social metadata. It currently describes the developer with inaccurate keywords and a generic description that doesn't reflect their real background (Java/Spring Boot backend engineer, Algeria-based, works with Django and AI tools).

## What to change

### 1. Replace the `DESC` constant

Current:
```
"Designs and builds performant, opinionated software — from full-stack platforms to interfaces engineered for speed and clarity. Casablanca / Remote."
```

Replace with:
```typescript
const DESC =
  "Backend and full-stack engineer based in Algeria — Spring Boot systems, React interfaces, and AI-integrated products. Available for remote work globally.";
```

### 2. Replace the `TITLE` constant

Current:
```
"Oussama Bendou — Software Engineer"
```

Replace with:
```typescript
const TITLE = "Oussama Bendou — Backend & Full-Stack Engineer";
```

### 3. Replace the `keywords` array

Current (inside `metadata`):
```typescript
keywords: [
  "Oussama Bendou",
  "software engineer",
  "portfolio",
  "Next.js",
  "TypeScript",
  "Casablanca",
  "Remote engineer",
],
```

Replace with:
```typescript
keywords: [
  "Oussama Bendou",
  "oussthecodeguy",
  "software engineer",
  "backend engineer",
  "full stack developer",
  "Java",
  "Spring Boot",
  "TypeScript",
  "React",
  "Next.js",
  "Django",
  "Python",
  "PostgreSQL",
  "AWS",
  "Algeria",
  "Béjaïa",
  "remote engineer",
  "AI integration",
  "product engineer",
  "portfolio",
],
```

### 4. Update the OG image alt text

Inside the `openGraph.images` array, update the `alt` field to match the new title:

Current: `"Oussama Bendou — Software Engineer"`
Replace with: `"Oussama Bendou — Backend & Full-Stack Engineer"`

## What NOT to touch

- The `SITE` constant and URL
- The `metadataBase`, `alternates`, `authors`, `creator` fields
- The `openGraph` structure (only the `alt` text changes)
- The `twitter` block structure (title and description update automatically via the constants)
- The `robots` config
- The `viewport` export
- The `RootLayout` component

## Steps

1. Read `src/app/layout.tsx`
2. Apply the 4 edits above using the Edit tool (one call per edit)
3. Verify the file still compiles by checking there are no obvious syntax issues
4. No build step needed — this file has no logic, only metadata strings
