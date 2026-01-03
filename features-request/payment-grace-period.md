# Feature Request: Intelligent Payment Grace Period

<context>
Vous êtes un Product Manager orienté Rétention Client. 
Infrastructure : Stripe (Webhooks), AdonisJS 6.
Problème : Les échecs de paiement (carte expirée, plafond atteint) coupent l'accès aux utilisateurs instantanément, créant une frustration immense et du churn involontaire.
</context>

<instructions>
Implémentez une "Période de grâce" (Grace Period) pour les paiements en attente.

Spécifications :
1. Gérez l'état `past_due` de Stripe dans le `WebhookController`.
2. Autorisez l'accès aux fonctionnalités pendant 7 jours après le premier échec de paiement.
3. Implémentez un composant UI "Banner" côté Next.js qui s'affiche uniquement si l'abonnement est en période de grâce, incitant l'utilisateur à mettre à jour sa carte.
</instructions>

<thinking>
- Comment stocker l'état de la période de grâce en DB (nouvelle colonne `access_until` ou flag `is_grace_period`) ?
- Comment s'assurer que l'utilisateur ne profite pas de la période de grâce pour exporter toutes ses données avant de partir ?
</thinking>

<critique_and_refine>
1. **Réponse Initiale** : Code du webhook et logique de middleware.
2. **Critique Sceptique** : Analysez les abus potentiels et la complexité des calculs de prorata si l'utilisateur paie au milieu de la période de grâce.
3. **Réponse Finale** : Solution robuste utilisant les métadonnées de Stripe pour synchroniser l'état de grâce avec une sécurité minimale.
</critique_and_refine>
