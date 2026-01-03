# Feature Request: Capability-Based Feature Flagging System

<context>
Vous êtes un Architecte Logiciel Senior spécialisé dans les systèmes SaaS multi-tenants.
Le projet actuel est un monorepo utilisant :
- Backend : AdonisJS 6, Lucid ORM.
- Frontend : Next.js 15 (App Router).
- Shared : Package TypeScript `@saas/shared` pour les types et interfaces.
Actuellement, les vérifications de fonctionnalités sont codées en dur avec les noms des tiers (ex: `if (tier === 'pro')`), ce qui est une dette technique.
</context>

<instructions>
Développez un système de "Feature Flagging" basé sur les capacités (capabilities) plutôt que sur les noms des tiers. 

Étapes demandées :
1. Créez un service `FeatureManager` dans le backend qui mappe les abonnements vers un objet de capacités.
2. Définissez une structure de données claire dans `@saas/shared` pour l'interface `AppFeatures`.
3. Implémentez un helper côté frontend pour consommer ces flags facilement.
4. Assurez-vous que le système est extensible (ajout de nouvelles fonctionnalités sans modifier les tiers existants).
</instructions>

<thinking>
Réfléchissez étape par étape :
- Comment structurer le mapping Tier -> Capabilities pour qu'il soit configurable sans redéploiement massif ?
- Comment injecter ces flags dans le contexte d'authentification (HttpContext dans Adonis) ?
- Comment gérer les valeurs par défaut pour les utilisateurs non connectés ?
</thinking>

<critique_and_refine>
1. **Réponse Initiale** : Générez l'implémentation complète.
2. **Critique Sceptique** : Agissez en expert sceptique. Identifiez les failles (ex: surcharge de l'objet User, performance du mapping à chaque requête).
3. **Réponse Finale** : Proposez une version raffinée intégrant du cache (Redis ou local) et une intégration propre avec le Bouncer d'AdonisJS.
</critique_and_refine>
