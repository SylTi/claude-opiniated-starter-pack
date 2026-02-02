# Enterprise + Marketplace — Security & Pricing Summary (Current Decisions)

This document summarizes the security posture and commercial model we converged on for:
- **Enterprise features (Tier 2)**
- **Marketplace access + official plugins (Tier 1)**

It also captures pricing options, recommended starting numbers, and why/when you’d move up/down.


## 1) Threat model & enforcement reality

### 1.1 Self-hosted means “updates/enrollment” enforcement, not runtime locks
If customers self-host and control the runtime, you **cannot** technically force perpetual recurring payments once they have the code.

So our practical enforcement lever is:
- **Active subscription ⇒ access to official distribution (marketplace) + updates**
- **No subscription ⇒ no marketplace access + no updates**
- Installed versions can keep running (by design), but they drift and lose support/compat/security updates.

This avoids “we host customer infra” while still creating strong renewal pressure for serious teams.


## 2) Marketplace security choices

### 2.1 Hard separation: OSS vs Marketplace builds
**Non-negotiable rule:** The **OSS tier must not ship marketplace download/install plumbing** as “hidden features”.

- OSS build:
  - plugin runtime exists (Tier A/B hooks)
  - users can build/install their own private plugins
  - **no marketplace UI/CLI**, no marketplace endpoints, no registry proxy client
- Marketplace tier (Tier 1+):
  - includes marketplace UI/CLI and installer logic

Reason: if OSS includes marketplace clients/endpoints, the paywall becomes “403 theater” and is easily mirrored.

### 2.2 Paid marketplace access (annual) gates the distribution channel
Tier 1 sells **access to official plugin distribution**:
- browse/install/update official plugins
- receive verified releases
- get compatibility-tested artifacts

This is the key “clean break” between Free and Tier 1.

### 2.3 Private distribution + short-lived credentials (best-practice)
To keep marketplace access meaningfully gated:
- Official plugin packages live behind private distribution (private registry or vendor-controlled artifact delivery).
- Access is granted via **short-lived credentials** minted to active subscribers (“token vending”).
- Customers refresh credentials periodically; expired credentials cannot fetch new artifacts.

This is stronger than long-lived static tokens (which leak and get shared).

### 2.4 Signing / verification (recommended)
If you want the marketplace to be defensible (and worth paying for), add:
- signed plugin artifacts
- signature verification in the installer
- optional revocation feed for compromised plugin versions

This turns “marketplace access” into “trusted supply chain”, not just a paywall.

### 2.5 Policy on cancellation (explicit)
When a customer stops paying:
- marketplace access ends ⇒ cannot download new plugins/versions
- already-installed plugins may keep running
- no updates and no new installs via official channel

This matches the overall “pay for updates/ecosystem access” model and avoids runtime hostage situations.


## 3) Enterprise security choices (Tier 2)

### 3.1 Enterprise is “all-in” bundle (for now)
Externally: Enterprise is **all-or-nothing** for now (simple sales, simple support matrix).
Internally: implement feature-level entitlements so you can split later without refactoring.

Reason: tier-splitting early explodes testing/support complexity and creates “it doesn’t work on my plan” churn.

### 3.2 Enterprise includes Tier C primitives + enterprise-only plugins
Tier 2 includes:
- Tier C “enterprise/infra modules” (SSO, advanced audit/compliance, encryption providers, etc.)
- any plugins that depend on Tier C primitives
- marketplace access

### 3.3 Online-first assumption (no airgapped/offline licensing)
We agreed offline mode is not a primary requirement:
- your product is for building SaaS; deployments are expected online
- therefore subscription enforcement via online distribution is aligned with the domain

### 3.4 Minimal vendor “control plane” is optional, not your customer infra
We explicitly avoided becoming “the operator of customer production stacks”.
If you run anything vendor-side, keep it tiny:
- artifact/registry access control
- signing keys
- license/subscription status

This is not “hosting customer infra”. It’s distribution and supply-chain control.


## 4) Pricing model we adopted (3 tiers)

### Tier 0 — OSS (Free)
- skeleton core + plugin runtime (Tier A/B)
- users can ship their own private plugins
- **no marketplace access**
- **no enterprise Tier C features**

### Tier 1 — Marketplace Access (Annual) + Pay-Per-Plugin
- **annual marketplace membership required** to browse/install/update official plugins
- membership gives access to all “free official plugins” (included with membership)
- **paid plugins are purchased separately**
- official plugins only (for now); third-party later possibly

### Tier 2 — Enterprise (Annual, expensive)
- includes marketplace access
- includes Tier C features + Tier C-dependent plugins
- should be procurement-simple (avoid nickel-and-diming enterprises)


## 5) Suggested amounts + why

### 5.1 Marketplace Access (Tier 1 membership)
**Recommended starting point (early catalog):**
- **€1,500 / year / company**

Why this number:
- Filters tire-kickers while still being below “enterprise procurement pain”.
- Forces a real buyer (“I’m building a serious SaaS”) without requiring big-company budgets.
- Leaves room above for Enterprise pricing.

**Later (when catalog + trust guarantees are strong):**
- **€2,500 / year / company**, OR
- **€1,500 / year includes 1 production deployment + €500 / year per additional production deployment**

Why/when to increase:
- when the plugin catalog is broad enough that membership clearly pays for itself
- when you provide strong marketplace guarantees (signing, compatibility matrix, revocation)
- when support/maintenance costs rise with usage and you need to keep quality high

When to keep it lower:
- if the catalog is thin and you need adoption
- if you can’t yet justify the “trusted supply chain” story

### 5.2 Paid plugins pricing (Tier 1)
We recommended **annual maintenance per plugin** by default (not monthly, not one-time).
Reason:
- aligns with your enforcement lever (“no renewal ⇒ no updates”)
- avoids the support trap of one-time sales
- funds ongoing compatibility work as the skeleton evolves

Suggested annual bands:
- **€300–€800 / year**: small/contained integrations
- **€1,200–€3,000 / year**: heavy operational modules (imports at scale, advanced webhooks, etc.)
- **€5,000–€15,000 / year**: “product-level” modules (rare)

Optional (later) procurement-friendly option:
- “Perpetual license” with **12 months updates included**, then optional annual renewal.
Avoid “lifetime updates”.

### 5.3 Enterprise pricing options (Tier 2) — the missing part

You asked for the pricing options we discussed for Enterprise; they were **missing** in the previous export.
Below are the concrete options, with suggested amounts and the trade-offs.

#### Option E1 — Per company (includes 1 product) + per additional product add-on (recommended)
**Suggested:**
- **Enterprise:** **€15,000 / year / company** (includes **1** production product/deployment)
- **Add’l production product:** **€5,000 / year** each
- Unlimited tenants/end-users; dev/staging included

Why this is the best default:
- Easy to explain and sell (“one platform license per company”)
- Still scales revenue if they run multiple SaaS products
- Limits “unlimited products for one price” arbitrage
- Keeps procurement simpler than per-seat/MAU models

When to raise/lower:
- Raise Enterprise to **€20k–€25k** once you have strong enterprise proof (SSO/BYOK/audit maturity + references).
- Lower (temporarily) to **€10k–€12k** only if you need early lighthouse customers.

#### Option E2 — Pure per product/deployment (no company base)
**Suggested:**
- **€12,000–€18,000 / year per production product**

Pros:
- Highest revenue alignment for multi-product companies
- Simple for single-product startups

Cons:
- More friction in sales (“why pay twice?”)
- People will attempt to undercount “products” by jamming everything into one deployment

This option can work later when you have crisp definitions and auditability.

#### Option E3 — Per company unlimited products (avoid early)
**Suggested:**
- **€25,000–€40,000 / year / company**

Pros:
- Very easy procurement
- Removes “how many products do you have?” debates

Cons:
- Leaves a lot of money on the table for multi-product operators
- Encourages big customers to consolidate usage under one license

Only choose this if you want *maximum simplicity* and you’re happy to price high enough to compensate.

#### Option E4 — Enterprise+ support/SLA tier (optional later)
**Suggested:**
- **€30,000–€60,000 / year** (depending on scope)
- Adds: upgrade assistance, response windows, “we review your upgrade PRs”, roadmap input

Pros:
- Makes the economics work without relying on lawsuits
- Aligns with “enterprise means consequences”

Cons:
- You must actually deliver the support expectations

#### Option E5 — Consumption/MAU/seat-based (strongly discouraged)
Even though it “scales”, it becomes a growth tax and makes successful customers resent you.
Avoid unless you’re forced by market norms in your niche.

### 5.4 How Tier 1 spend rolls into Enterprise (recommended policy)
To prevent Tier 1 from feeling like a dead-end, offer an upgrade credit:
- If a company upgrades to Enterprise within 12 months,
  - credit **X%** (e.g., 50–100%) of their last 12 months of plugin spend against the Enterprise invoice.

This reduces friction and encourages “start small → go enterprise” without punishing early adopters.


## 6) Plugin catalog policy (official now, third-party later)

### 6.1 Now: official-only
This keeps:
- QA manageable
- trust story coherent
- support boundaries clear

### 6.2 Later: third-party + revenue share (optional)
If/when you add third-party paid plugins, plan for:
- payouts
- VAT/tax handling
- refunds/disputes
- review/security scanning
- signature requirements + revocation mechanism

Recommendation: delay third-party until you have a stable installed base and robust verification/signing pipeline.


## 7) What must be true for Tier 1 to sell
If Tier 1 is paid marketplace access, it must offer real value beyond “download gate”:
- verified/signed artifacts
- compatibility matrix (“works with skeleton X.Y”)
- curated official plugins worth paying for
- update discipline and a trustworthy supply chain

Otherwise, Tier 1 will be perceived as a tax.


## 8) Summary (decisions locked in)
- Marketplace access itself is **paid annual subscription**.
- Tier 1 is **membership + pay-per-plugin**; membership includes access to “free official plugins”.
- Paid plugins are **annual maintenance** by default.
- Enterprise remains **all-in** for now; implement entitlements internally to split later if needed.
- Enforcement is via **distribution + updates**, not runtime locks.
- Keep OSS and marketplace builds **hard-separated** to avoid paywall bypass.
