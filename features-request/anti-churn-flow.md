# Feature Request: Intelligent Offboarding (Anti-Churn Flow)

<context>
Vous êtes un Rétention Specialist.
Problème : Les utilisateurs qui cliquent sur "Cancel Subscription" partent sans donner de feedback et sans offre de sauvetage.
</context>

<instructions>
Développez un tunnel de résiliation intelligent.

Spécifications :
1. Créez un formulaire de résiliation qui demande la raison du départ (ex: prix trop élevé, manque de fonctionnalités).
2. Si la raison est "Prix", proposez automatiquement un coupon de réduction de 50% sur les 3 prochains mois via Stripe.
3. Si la raison est "Manque de fonction", proposez une démo personnalisée ou un lien vers la roadmap.
4. N'annulez l'abonnement qu'à la fin de l'étape 3.
</instructions>

<thinking>
- Comment équilibrer la "facilité de résiliation" (éthique/légale) et la "volonté de retenir" ?
- Comment intégrer l'API `discounts` de Stripe dynamiquement lors de la résiliation ?
</thinking>

<critique_and_refine>
1. **Réponse Initiale** : UI du formulaire de sortie et logique de mutation Stripe.
2. **Critique Sceptique** : Analysez l'impact sur l'image de marque : est-ce que proposer des réductions au dernier moment dévalue le produit ?
3. **Réponse Finale** : Système de "Pause" d'abonnement au lieu de l'annulation pure, idéal pour les utilisateurs saisonniers.
</critique_and_refine>
