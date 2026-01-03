# Feature Request: High-Conversion Pricing Toggle (Annual vs Monthly)

<context>
Vous êtes un Senior Growth Marketer et Frontend Engineer.
Pile : Next.js 15, Tailwind CSS, shadcn/ui.
Objectif : Augmenter le revenu annuel récurrent (ARR) en incitant au paiement annuel via une réduction attractive.
</context>

<instructions>
Concevez un sélecteur de prix moderne et persuasif.

Fonctionnalités attendues :
1. Créez un switch "Mensuel / Annuel" animé avec shadcn/ui.
2. Appliquez une réduction de 20% (ou "2 mois offerts") sur le prix annuel.
3. Affichez clairement l'économie réalisée pour chaque Tier (ex: "Économisez 40€/an").
4. Gérez la sélection des `price_id` Stripe corrects lors du clic sur le bouton "Upgrade".
</instructions>

<thinking>
- Comment présenter le prix annuel pour qu'il paraisse bas (ex: afficher le prix mensuel équivalent mais facturé annuellement) ?
- Comment gérer les tooltips pour expliquer les taxes (TVA incluse ou non) ?
</thinking>

<critique_and_refine>
1. **Réponse Initiale** : Composant React `PricingTable` avec logique de switch.
2. **Critique Sceptique** : Critiquez la clarté du prix (tromperie potentielle sur l'affichage mensuel/annuel) et l'impact sur le responsive design (table trop large sur mobile).
3. **Réponse Finale** : Version raffinée avec une "Garantie de remboursement" mise en avant et un design optimisé pour mobile.
</critique_and_refine>
