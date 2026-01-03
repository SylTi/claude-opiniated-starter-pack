# Feature Request: Full Self-Service via Stripe Customer Portal

<context>
Vous êtes un Senior Backend Developer.
Défi : Gérer manuellement les changements de carte bancaire, l'historique des factures et la gestion de la TVA est chronophage et risqué.
</context>

<instructions>
Intégrez le Stripe Customer Portal pour une autonomie totale des clients.

Spécifications :
1. Créez un endpoint backend `/api/v1/billing/portal` qui génère une URL de session pour le portail client Stripe.
2. Assurez-vous que l'URL de retour (`return_url`) pointe vers les réglages de la team ou du profil.
3. Implémentez un bouton "Manage Billing & Invoices" dans l'UI frontend Next.js.
4. Supprimez toutes les interfaces internes de gestion de carte bancaire pour déléguer 100% à Stripe.
</instructions>

<thinking>
- Comment gérer les redirections fluides sans perdre le contexte de la Team actuelle ?
- Doit-on autoriser l'accès au portail à tous les membres de la team ou seulement à l'Admin ?
</thinking>

<critique_and_refine>
1. **Réponse Initiale** : Code du contrôleur Adonis et lien frontend.
2. **Critique Sceptique** : Analysez les limitations du portail Stripe (personnalisation visuelle limitée) et le risque de déconnexion de l'expérience utilisateur.
3. **Réponse Finale** : Intégration avancée avec les "Portal Configurations" de Stripe pour garder une cohérence visuelle avec l'application.
</critique_and_refine>
