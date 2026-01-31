# Roadmap SaaS - Fonctionnalités Partiellement Implémentées

Ce document détaille ce qui manque pour chaque fonctionnalité marquée comme partielle (`[~]`) dans le ROADMAP.md.

---

## 📋 Fonctionnalités SaaS Essentielles

### 1. 🔐 Système d'Authentification et Autorisation Complet

#### Vérification d'email et téléphone `[~]`

**Implémenté:**
- Vérification d'email avec tokens (`EmailVerificationToken` model)
- Endpoints: `GET /api/v1/auth/verify-email/:token`, `POST /api/v1/auth/resend-verification`
- Admin peut vérifier/dé-vérifier manuellement

**Manquant:**
- [ ] Vérification par SMS/téléphone (pas de provider SMS intégré)
- [ ] Intégration Twilio, Vonage, ou autre provider SMS
- [ ] Model `PhoneVerificationToken`
- [ ] Endpoints pour envoi/vérification SMS
- [ ] UI pour saisie du numéro de téléphone

---

### 2. 💰 Facturation et Abonnements

#### Factures PDF générées automatiquement `[~]`

**Implémenté:**
- Accès aux factures Stripe via Customer Portal
- Synchronisation des événements invoice via webhooks

**Manquant:**
- [ ] Génération de PDF personnalisés (avec branding tenant)
- [ ] Template de facture customisable
- [ ] Stockage local des factures PDF
- [ ] Endpoint `GET /api/v1/billing/invoices/:id/pdf`
- [ ] Librairie PDF (pdfkit, puppeteer, ou @react-pdf/renderer)

#### Dunning management (relances de paiement) `[~]`

**Implémenté:**
- Webhook `invoice.payment_failed` capturé
- Mise à jour du statut subscription

**Manquant:**
- [ ] Emails de relance automatiques (1ère, 2ème, 3ème tentative)
- [ ] Templates d'emails de dunning
- [ ] Configuration des délais entre relances
- [ ] Grace period avant suspension
- [ ] UI admin pour voir les paiements échoués
- [ ] Endpoint pour retry manuel d'un paiement

---

### 5. 🔌 API Publique et Marketplace

#### Rate limiting et quotas API `[~]`

**Implémenté:**
- Middleware throttle basique (limiter global)
- Configuration dans `start/limiter.ts`

**Manquant:**
- [ ] Rate limiting par clé API (pas de système de clés API)
- [ ] Quotas différenciés par plan (Free: 100 req/h, Pro: 10k req/h)
- [ ] Headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- [ ] Dashboard de consommation API pour les clients
- [ ] Alertes de dépassement de quota
- [ ] Model `ApiUsage` pour tracking

---

### 6. 📊 Analytique et Reporting

#### Tableau de bord d'utilisation (MAU, DAU) `[~]`

**Implémenté:**
- Endpoint admin basique: `GET /api/v1/admin/stats`
- Retourne: totalUsers, totalTenants, activeSubscriptions, revenue

**Manquant:**
- [ ] Calcul MAU (Monthly Active Users)
- [ ] Calcul DAU (Daily Active Users)
- [ ] Tracking des sessions utilisateur
- [ ] Model `UserActivity` ou `AnalyticsEvent`
- [ ] Graphiques temporels (7j, 30j, 90j)
- [ ] Frontend dashboard avec visualisations
- [ ] Export des données d'utilisation

#### Metrics clés (MRR, ARR, Churn Rate) `[~]`

**Implémenté:**
- Revenue total basique via `admin/stats`
- Données de subscription stockées

**Manquant:**
- [ ] Calcul MRR (Monthly Recurring Revenue)
- [ ] Calcul ARR (Annual Recurring Revenue)
- [ ] Calcul Churn Rate (mensuel, annuel)
- [ ] LTV (Lifetime Value) par cohorte
- [ ] ARPU (Average Revenue Per User)
- [ ] Service `MetricsService` avec calculs
- [ ] Historique des métriques (snapshots mensuels)
- [ ] Comparaison période vs période précédente

---

### 7. 🛡️ Sécurité Avancée

#### Security headers (CSP, HSTS) `[~]`

**Implémenté:**
- Headers de base configurés dans AdonisJS
- CORS configuré

**Manquant:**
- [ ] Content-Security-Policy (CSP) strict
- [ ] Strict-Transport-Security (HSTS) avec preload
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options: DENY
- [ ] Referrer-Policy
- [ ] Permissions-Policy
- [ ] Audit de sécurité des headers (securityheaders.com)
- [ ] Configuration différente dev/prod

---

### 8. 🌍 Internationalisation et Localisation

#### Support multi-devises `[~]`

**Implémenté:**
- USD configuré dans Stripe
- Prix en USD dans la base

**Manquant:**
- [ ] Support EUR, GBP, CAD, etc.
- [ ] Conversion automatique des devises
- [ ] Affichage des prix dans la devise locale
- [ ] Intégration API de taux de change
- [ ] Stockage de la devise préférée utilisateur
- [ ] Facturation dans la devise du client

#### Fuseaux horaires `[~]`

**Implémenté:**
- Luxon utilisé pour manipulation des dates
- Dates stockées en UTC

**Manquant:**
- [ ] Préférence timezone par utilisateur
- [ ] Affichage des dates en timezone locale
- [ ] Sélecteur de timezone dans les settings
- [ ] Conversion automatique côté frontend
- [ ] Champ `timezone` sur le model User

#### Formats de date/heure locaux `[~]`

**Implémenté:**
- Luxon disponible pour formatage
- ISO 8601 utilisé dans l'API

**Manquant:**
- [ ] Préférence de format par utilisateur (DD/MM/YYYY vs MM/DD/YYYY)
- [ ] Format 12h vs 24h
- [ ] Localisation des noms de mois/jours
- [ ] Configuration côté frontend (react-intl, date-fns/locale)

---

## 🏗️ Améliorations d'Architecture

### 1. 🔧 Microservices Optionnels

#### Health checks avancés `[~]`

**Implémenté:**
- Endpoint basique `GET /health`
- Vérification DB connection

**Manquant:**
- [ ] Health check Redis (quand implémenté)
- [ ] Health check services externes (Stripe, S3, etc.)
- [ ] Readiness vs Liveness probes
- [ ] Métriques de latence des dépendances
- [ ] Format Kubernetes-compatible
- [ ] Dashboard de statut des services

---

## 📅 Phases du Roadmap

### Phase 2 - Monétisation

#### Factures et reçus `[~]`

Voir section "Factures PDF générées automatiquement" ci-dessus.

#### Dunning management `[~]`

Voir section "Dunning management (relances de paiement)" ci-dessus.

---

### Phase 4 - API et Intégrations

#### Rate limiting `[~]`

Voir section "Rate limiting et quotas API" ci-dessus.

---

### Phase 5 - Évolutivité

#### Monitoring avancé `[~]`

**Implémenté:**
- Logs structurés AdonisJS
- Health endpoint basique

**Manquant:**
- [ ] APM (Application Performance Monitoring) - Datadog, New Relic, ou Sentry
- [ ] Métriques custom (Prometheus/Grafana)
- [ ] Distributed tracing (OpenTelemetry)
- [ ] Error tracking avec context
- [ ] Alerting sur seuils (latence, erreurs, etc.)
- [ ] Dashboard opérationnel

---

### Phase 6 - Expérience Utilisateur

#### Support multi-devises `[~]`

Voir section "Support multi-devises" ci-dessus.

---

## 📊 Résumé des Efforts Estimés

| Fonctionnalité | Effort | Priorité |
|----------------|--------|----------|
| Vérification téléphone | Medium (2-3j) | Low |
| Factures PDF | Medium (2-3j) | Medium |
| Dunning management | Medium (3-4j) | High |
| Rate limiting API | High (4-5j) | High |
| Dashboard MAU/DAU | High (5-7j) | Medium |
| Métriques MRR/ARR | Medium (3-4j) | High |
| Security headers | Low (1j) | High |
| Multi-devises | High (5-7j) | Medium |
| Timezones | Low (1-2j) | Low |
| Formats locaux | Low (1-2j) | Low |
| Health checks | Low (1j) | Medium |
| Monitoring avancé | High (5-7j) | Medium |

---

*Dernière mise à jour: Janvier 2026*
