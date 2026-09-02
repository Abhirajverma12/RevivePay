# RevivePay: 5-Minute Pitch & Live Demo Script

**Track:** AI Revenue Recovery | **Hackathon:** Razorpay AI Buildathon  
**Target Time:** 5 Minutes (0:00 - 5:00)

---

## ⏱️ Minute-by-Minute Presentation Plan

### 0:00 – 0:30 | The Problem (Broken Recovery & Silent Churn)
> *"Hello judges. Every single day, Indian merchants lose 15% to 30% of their top-line revenue to silent payment failures. But the way payment recovery works today is fundamentally broken:*
> 1. *It treats every failure identically — spamming blind retries across cards, UPI, and net banking.*
> 2. *It ignores customer context — burning high-LTV subscribers on transient bank errors while wasting fees retrying expired cards.*
> 3. *It operates without guardrails — giving discounts where they aren't needed and retrying high-value payments blindly.*
>
> *Merchants are trapped between bleeding revenue and burning customer trust."*

---

### 0:30 – 1:00 | The Solution (RevivePay)
> *"Meet **RevivePay** — an Autonomous AI Revenue Recovery Engine built natively for Razorpay merchants.*
>
> *RevivePay replaces dumb static retry schedules with an intelligent, multi-layer decision pipeline:*
> - *It calculates an objective, deterministic recovery probability for every failed transaction.*
> - *It enforces hard merchant policy guardrails outside the LLM.*
> - *It uses an AI Agent to select the optimal recovery strategy with transparent, human-readable reasoning.*
> - *And it executes the recovery action live — from intelligent retries and delayed queues to personalized links and discount incentives."*

---

### 1:00 – 1:45 | Architecture (3-Tier Separation of Concerns)
*(Show Mermaid Architecture Diagram or walk through Dashboard)*

> *"Our architecture adheres to strict engineering rigor:*
> 1. **Layer 1: Deterministic Scorer**
>    *Uses an auditable 5-factor mathematical formula incorporating Historical Recovery Rate (30%), normalized LTV (20%), failure temporariness (20%), retry allowance (15%), and success ratio (15%). No hallucinations; pure math.*
> 2. **Layer 2: Merchant Policy Guardrails**
>    *A deterministic boundary sitting outside the AI Agent. If a transaction exceeds the merchant's high-value threshold (e.g. ₹50,000), it flags for human approval. If recovery probability is sub-30%, active interventions are blocked.*
> 3. **Layer 3: Autonomous AI Agent**
>    *A structured LLM agent bounded by Zod schema validation. It selects from 8 whitelisted recovery tools and produces a concise, single-sentence justification for merchant auditing.*
> 4. **Layer 4: Execution Engine & BullMQ Workers**
>    *Executes immediate retries, schedules delayed retries via BullMQ and Redis, generates payment links, and closes the loop by recording financial recovery outcomes."*

---

### 1:45 – 3:30 | LIVE DEMO (Two Contrasting Cases)

*(Presenter opens [http://localhost:5173/payments](http://localhost:5173/payments))*

#### Case 1: High-Probability Transient Failure (Immediate Recovery)
> *"Let's see this in action live with our first case:*
> - *We select **Aarav Saxena**, a tier-1 customer with **₹1,55,827 LTV** and an **83% historical recovery rate**.*
> - *His ₹4,999 UPI transaction failed due to **INSUFFICIENT_FUNDS**.*
> - *We click **Analyze & Decide**.*
> - *Notice the output: The mathematical engine computed an **81.7% recovery probability** with an expected recovery value of **₹4,084.68**.*
> - *The guardrail auto-approves because it's well within SaaSify's ₹45,000 threshold.*
> - *The AI Agent chooses **IMMEDIATE_RETRY** and generates this reasoning:  
>   `'Given Aarav Saxena's high LTV of ₹155,827 and 0 prior retries on temporary INSUFFICIENT_FUNDS, an immediate retry has an 82% recovery probability for ₹4,999.'`*
> - *Now watch: We click **Execute Recovery**.*
> - *The execution engine triggers the payment rail retry, marks the transaction **RECOVERED**, and recovers ₹4,999 to the merchant's bottom line in real time!"*

#### Case 2: Low-Probability / High-Value Guardrail (Policy Enforcement)
> *"Now let's contrast that with a difficult transaction:*
> - *We select a customer with an **EXPIRED_CARD** or a transaction exceeding **₹50,000**.*
> - *Watch the system adapt: The deterministic probability drops below 25%.*
> - *Rather than wasting merchant retry limits or spamming the customer, the guardrail kicks in:*
> - *The agent recommends **NO_ACTION** or **ALTERNATIVE_METHOD**, strictly bounded by the merchant's discount limits.*
> - *Notice how the financial margin is protected: RevivePay never gives away discounts unless the recovered LTV mathematically justifies the margin cost."*

---

### 3:30 – 4:15 | Analytics & Recovery Metrics
*(Presenter navigates to `/dashboard` and `/analytics`)*

> *"Every intervention feeds directly into our live aggregate analytics:*
> - *On our **Dashboard**, merchants monitor their **Revenue at Risk** (₹20.7 Lakhs), **Recovered Revenue**, and live **Recovery Rate**.*
> - *Our Recharts charts show real-time performance across all 8 recovery strategies — revealing which rails and messages yield the highest conversion.*
> - *And our **Failure Reasons Breakdown** identifies root causes like bank downtimes vs user errors.*
> - *Everything is computed live from PostgreSQL tables — zero hardcoded numbers."*

---

### 4:15 – 4:45 | Proactive Transparency: What's Real vs. What's Simulated
> *"We believe in brutal engineering honesty. Here is our exact breakdown:*
> - **WHAT IS 100% REAL:**
>   - *The full NestJS backend, TypeScript code, and PostgreSQL 18 schema.*
>   - *The deterministic 5-factor mathematical scoring engine and unit test suite.*
>   - *The external merchant policy guardrail evaluation engine.*
>   - *The BullMQ queue and worker running on native Redis 7.*
>   - *The JWT authentication, password hashing, and multi-tenant merchant data isolation.*
>   - *All aggregate analytics queries and the complete React dashboard.*
> - **WHAT IS SIMULATED (AND CLEARLY LABELED):**
>   - *The payment gateway simulator generating synthetic failure events and recovery coin-flips.*
>   - *SMS & WhatsApp dispatches (we log the payload rather than burning real Twilio/Gupshup credits).*
>   - *Payment links format (`https://rzp.io/i/sim_revive_...`) for safe local testing.*
>   *Notice that every screen in our UI clearly displays a visible **'Simulated demo data'** badge."*

---

### 4:45 – 5:00 | Conclusion & Q&A
> *"RevivePay turns payment failures from a revenue graveyard into an automated recovery engine — recovering lost revenue while preserving merchant margins and customer trust.*
>
> *Thank you, judges. We are ready for your questions!"*
