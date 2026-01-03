# Code Review Fixes - Implementation Tracker

## Phase 1: Critical Security

- [x] **1.1 Rate Limiting** - Install @adonisjs/limiter, configure strict thresholds, disable in test env
- [x] **1.2 Race Condition (addMember)** - Wrap check-and-write in transaction with row locking
- [x] **1.3 Zombie Teams** - Change FK to RESTRICT, add null check in getSubscriberInfo()

## Phase 2: High Priority Security

- [x] **2.1 User Enumeration** - Generic 201 response + 100-300ms timing delay
- [x] **2.2 Webhook Error Handling** - Generic 400 to Stripe, detailed internal logging

## Phase 3: Performance & Security Hardening

- [x] **3.1 Middleware Performance** - JWT signed cookie with jose for admin role
- [x] **3.2 Security Headers** - Add CSP + HSTS headers
- [x] **3.3 URL Configuration** - Use FRONTEND_URL for invitation links

## Phase 4: Code Quality

- [ ] ~~**4.1 Docker Port Binding**~~ - Skipped per user request
- [x] **4.2 Constants/Enums** - Created roles constants in `app/constants/roles.ts`
- [x] **4.3 Logger Migration** - Replaced console.error with AdonisJS Logger

---

## Skipped (Invalid Findings)

- ~~Webhook Idempotency~~ - Already implemented in stripe_provider.ts
- ~~Avatar XSS~~ - VineJS url() validates http/https by default
