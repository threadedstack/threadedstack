# Threaded Stack Pricing

## Billing Model Overview

Threaded Stack uses a simple billing model: **users pay, organizations consume.**

A subscription belongs to you, the individual user. You can only have one active subscription at a time. When you create an organization (or multiple organizations), the resource limits for each org are determined by your subscription tier. If you are on the Pro plan and own three organizations, all three receive Pro-level limits independently.

Usage (how many projects you have created, how many threads you have opened, how much compute you have used) is tracked per organization, per billing month. Your invoice, however, is tied to you personally since you are the paying account.

In short:

- **You subscribe.** Your subscription determines what your organizations are allowed to do.
- **Your organizations use resources.** Each org tracks its own usage against your plan limits.
- **You get one bill.** Invoices are issued to you, not to individual organizations.

---

## Tier Comparison

Threaded Stack offers four subscription tiers: **Free**, **Solo**, **Pro**, and **Team**. Current pricing, limits, and feature breakdowns are available on the [Pricing page](/pricing), which loads live data from the backend API.

> **Note:** Canonical pricing is defined in `repos/domain/src/constants/plans.ts` and served via the backend API. The pricing page and admin dashboard both read from this source. Do not hardcode prices in documentation.

---

## What Each Tier Unlocks

### Free -- Get Started at No Cost

The Free tier is for anyone who wants to explore the platform, follow tutorials, or build a proof of concept. You get one organization, two projects, and enough compute and messaging capacity to experiment without worrying about a bill. There is no credit card required. Thread and message history is retained for 7 days.

**Best for:** Students, hobbyists, and developers evaluating the platform before committing.

### Solo -- Ship Real Projects

Solo removes the training-wheels limits and gives you room to build production-grade applications. With 10 projects, 20 endpoints, and 10,000 compute units per month, you can run meaningful workloads. You also gain a second organization, 30-day data retention, and email support.

**Best for:** Independent developers and solo founders who are building and deploying real applications.

**Why upgrade from Free:** More projects, significantly more compute and messaging capacity, longer data retention, and direct email support.

### Pro -- Build as a Team

Pro is designed for small teams and agencies. It includes 3 seats out of the box (with the option to add more at $10/seat/month), 5 organizations, 50 projects, and 100,000 compute units. Threads, messages, endpoints, and secrets are all unlimited, so your team can focus on building rather than monitoring limits. Data retention extends to 90 days, and you gain access to custom domains and priority support.

**Best for:** Small teams, freelance agencies, and startups that need collaboration and higher-scale compute.

**Why upgrade from Solo:** Team seats, unlimited threads/messages/endpoints/secrets, 10x more compute, custom domains, and priority support.

### Team -- Scale Without Limits

Team is for organizations that need no resource ceilings. Organizations, projects, compute, threads, messages, endpoints, and secrets are all unlimited. You start with 10 included seats and can add more at $8/seat/month (a lower per-seat rate than Pro). Data retention is a full year, and you receive dedicated support.

**Best for:** Growing startups, established companies, and any organization operating at scale.

**Why upgrade from Pro:** Unlimited everything, more included seats, lower per-seat cost, 365-day retention, and dedicated support.

---

## Usage and Quotas

### How Usage Is Tracked

Every time your organization creates a resource (a project, an endpoint, a thread, a message, a secret) or executes compute, the platform increments a counter for that resource type. These counters are scoped to your organization and the current billing month (tracked as a calendar month, e.g., "2026-04").

When a resource is deleted (for example, removing a project or an endpoint), the counter is decremented so that the freed capacity is available again. Thread and message counts are not decremented because those resources are append-only.

### What Happens When You Hit a Limit

If your organization attempts to create a resource and the current count for that resource type has already reached the plan limit, the request is denied with a clear error that identifies the resource, the current usage, and the limit. No partial resources are created. The rest of your organization continues to operate normally; only the specific resource type that is at capacity is blocked.

Resources that have an "Unlimited" designation on your plan are never blocked.

### What Happens When a New Billing Period Starts

When your subscription renews each month, all usage counters for your organizations are reset to zero. This happens automatically when Stripe processes your recurring invoice. You start each billing period with a clean slate.

### How to Check Your Usage

You can view your current usage and plan limits in the Billing section of the Admin dashboard. The Quota Usage panel shows each tracked resource, how much you have used, and your plan cap. If you are approaching a limit, you can upgrade your plan directly from the same page.

---

## Billing FAQ

### Can I change my plan at any time?

Yes. You can upgrade or downgrade your subscription at any time from the Billing page in the Admin dashboard.

- **Upgrading** takes effect immediately. Stripe prorates the charge so you only pay the difference for the remainder of your current billing period.
- **Downgrading to a lower paid tier** also takes effect immediately with prorated billing.
- **Downgrading to Free** cancels your paid subscription at the end of the current billing period. You keep your paid-tier limits until the period expires, and then your organizations revert to Free-tier limits.

### What happens if I cancel my subscription?

When you cancel, your subscription remains active through the end of the current billing period (you have already paid for that time). Once the period ends, your account reverts to the Free tier. Your data is not deleted, but if your organizations exceed Free-tier limits, you will not be able to create new resources of those types until you either upgrade again or reduce usage.

### How are overages handled?

Threaded Stack does not charge for overages. Instead, it uses hard limits. When you reach the cap for a resource type, new creation requests for that resource are blocked until you upgrade your plan or free up capacity (by deleting resources, where applicable). You will never receive a surprise bill for exceeding your plan.

### Can multiple organizations share one subscription?

Yes. Your subscription covers all organizations you own. Each organization gets its own independent set of usage counters, all governed by the same tier limits. For example, if you are on the Pro plan and own three organizations, each one independently gets up to 50 projects, 100,000 compute units, and so on.

### What payment methods are accepted?

Payments are processed through Stripe. You can pay with any major credit or debit card. Stripe also supports additional payment methods depending on your region.

### Where can I view my invoices?

Invoices are available in the Billing section of the Admin dashboard. Each invoice includes a link to a hosted Stripe invoice page where you can view the full details and download a PDF receipt.

### What happens if a payment fails?

If a payment fails, your subscription is marked as "past due." Stripe will retry the charge according to its retry schedule. During this time your plan limits remain in effect. If the payment ultimately cannot be collected, your subscription may be canceled and your account will revert to the Free tier.

### Can I add more seats to my plan?

Seats can be added on the Pro and Team tiers. Pro includes 3 seats at $10 per additional seat per month. Team includes 10 seats at $8 per additional seat per month. The Free and Solo tiers include 1 seat each and do not support additional seats. To add team members on Free or Solo, you would need to upgrade to Pro or Team.
