# Subscriptions and Payments

Users must subscribe to a payment plan to use the Threaded Stack platform. The implementation allows for User-Based Subscriptions with Organization-Based Quotas. The following is a high-level breakdown of the payment subscription model:

## 1. Billing Model: "User Pays, Orgs Consume"

### The Payer (Subscriber) -> **The User**
* The subscription is attached to the **User** (Account Owner).
* A user can only have **one** active subscription at a time.
* Implementation: `subscriptions` table linked to `user_id`.

### The Consumer (Resource) -> **The Organization**
* Quota limits (Function calls, Threads) are enforced at the **Organization** level.
* Implementation: `quotas` table linked to `org_id`.

### Aggregation Logic
* When an Organization consumes a resource (e.g., runs a function), the system checks the **Owner's** subscription tier.
* If a User owns multiple Organizations (e.g., on the `Developer` tier), the usage limits apply to **each Application individually**.

## 2. Tier Hierarchy

The structure follows a standard "Good, Better, Best" SaaS progression.

| Feature | **Free** (Hobby) | **Basic** (Starter) | **Developer** (Growth) | **Pro** (Scale) |
| :--- | :--- | :--- | :--- | :--- |
| **Price** | **$0** | **$5** / mo | **$20** / mo | **$50** / mo |
| **Target** | Learning / Side Project | Solo Founders | Small Teams / Agencies | Startups / High Scale |
| **Orgs** | 1 | 1 | 5 | 10 |
| **Members**| 2 | 5 | 20 | 50 |
| **Calls** | 10k / mo | 50k / mo | 200k / mo | 1M / mo |
| **Runtime**| 15s | 30s | 60s | 600s |
| **Threads** | 1k / mo | 3k / mo | 10k / mo | 50k / mo |
| **History**| 1 Month | 3 Months | 6 Months | 1 Year |


## 3. Technical Implementation

### Polar.sh (Billing Engine)
- Handles billing, invoicing, and credit card processing.
- Sends webhooks (`subscription.created`, `subscription.updated`) to the backend.

### Database (State & Tracking)
- **`subscriptions` table**: Syncs the state (Active/Canceled) and Tier from Polar.
- **`quotas` table**: Locally tracks volume (e.g., how many function calls used this month).

### Access Gates
1.  **Subscription Gate**: "Does User X have an active subscription?"
    - *Check*: `subscriptions` table.
2.  **Usage Gate**: "Has Org Y exceeded 50,000 calls?"
    - *Check*: `quotas` table vs Tier Limit.
