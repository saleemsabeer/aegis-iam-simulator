# Aegis IAM Simulator & Drift Detector

## What This Is
Multi-cloud IAM policy simulator, drift detector, and least-privilege analyzer. Takes IAM policies (AWS/Azure/GCP), evaluates access requests against them, detects drift between baseline and current state, and analyzes CloudTrail logs to score least-privilege adherence. Claude API provides plain-English explanations for every verdict and recommendation.

## Stack
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- @anthropic-ai/sdk
- Vercel AI SDK (streaming responses)
- @monaco-editor/react (policy editor)
- Deployed on Vercel

## Project Structure
```
aegis-iam-simulator/
├── app/
│   ├── layout.tsx            # Root layout, dark theme, fonts
│   ├── page.tsx              # Main page with tab navigation
│   ├── api/
│   │   ├── analyze/route.ts  # POST - evaluate policy + Claude explanation
│   │   ├── drift/route.ts    # POST - diff baseline vs current + risk commentary
│   │   └── least-privilege/route.ts  # POST - CloudTrail analysis + recommendations
├── components/
│   ├── PolicyEditor.tsx      # Monaco editor, cloud selector, sample policies
│   ├── SimulationResults.tsx # Verdict cards, expandable matched statements, AI explanation
│   ├── DriftDetector.tsx     # Baseline vs current diff, risk badges, AI commentary
│   ├── LeastPrivilegeAnalyzer.tsx  # Log upload, usage table, score donut, AI recommendations
│   ├── CloudSelector.tsx     # AWS/Azure/GCP toggle
│   └── ui/                   # shadcn components
├── lib/
│   ├── anthropic.ts          # Shared Anthropic client wrapper
│   ├── evaluators/
│   │   ├── aws.ts            # AWS IAM policy evaluation (statement matching, wildcards, deny logic)
│   │   ├── azure.ts          # Azure RBAC evaluator (Actions/NotActions)
│   │   └── gcp.ts            # GCP IAM binding evaluator (role mapping, conditions)
│   ├── types.ts              # Shared types (Policy, SimulationRequest, Verdict, DriftResult, etc.)
│   └── sample-data.ts        # Sample policies and simulation requests per cloud
├── CLAUDE.md
├── .env.local                # ANTHROPIC_API_KEY
└── vercel.json
```

## Key Design Decisions
- Client-side evaluation runs instantly for fast UX. Claude API call is async and streams the explanation in after the verdict renders.
- Evaluation order for AWS: Explicit Deny > Allow > Implicit Deny. Always check all statements.
- Azure: NotActions block first, then Actions match.
- GCP: Role-to-permission mapping is hardcoded for common roles. Condition evaluation is best-effort.
- Dark theme: bg `#0a0e17`, surface `#111827`, accent cyan `#22d3ee`, deny `#f43f5e`, allow `#34d399`, warn `#fbbf24`.
- URL params store active cloud and tab for shareable state.

## API Routes

### POST /api/analyze
```json
{
  "cloud": "aws" | "azure" | "gcp",
  "policy": "string (JSON)",
  "action": "s3:GetObject",
  "resource": "arn:aws:s3:::prod-data/*",
  "principal": "arn:aws:iam::123456789012:user/analyst",
  "verdict": "ALLOW" | "EXPLICIT_DENY" | "IMPLICIT_DENY",
  "matchedStatement": {}
}
```
Returns streamed text explanation of why access was allowed/denied and security implications.

### POST /api/drift
```json
{
  "cloud": "aws" | "azure" | "gcp",
  "baseline": "string (JSON policy)",
  "current": "string (JSON policy)"
}
```
Returns JSON array of drift items with AI risk commentary.

### POST /api/least-privilege
```json
{
  "cloud": "aws",
  "policy": "string (JSON)",
  "logs": [{ "action": "s3:GetObject", "timestamp": "...", "count": 142 }]
}
```
Returns utilization score and removal recommendations.

## Env Vars
- `ANTHROPIC_API_KEY` — required, set in Vercel dashboard and `.env.local`

## Commands
```bash
npm run dev          # local dev server
npm run build        # production build
npm run lint         # eslint
vercel               # deploy to Vercel
vercel --prod        # production deploy
```

## Coding Conventions
- No default exports except page/layout files
- Use `cn()` utility from shadcn for conditional classes
- All API routes use edge runtime where possible
- Stream AI responses using Vercel AI SDK `streamText`
- Keep evaluator logic pure (no side effects, no API calls) — AI enrichment happens at the API route layer
- Error handling: every API route returns structured `{ error: string }` on failure
- No em dashes in UI copy. Keep text direct and concise.

## Brand
This is part of the Aegis IAM product line. Existing site: https://aegis-iam.vercel.app/
GitHub: set remote to your repo once initialized.

## Related Context
- Owner: Saleem (Senior Cloud Security Engineer, CTO @ Stoa)
- Certs: AWS SA Pro, GCP Associate, Azure Fundamentals, Security+
- This project serves as both a portfolio piece and a potential Stoa product
