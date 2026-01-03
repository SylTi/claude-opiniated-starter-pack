# Feature Request: Quota Visibility & Automated In-App Upselling

<context>
Vous êtes un Product-Led Growth (PLG) Engineer. 
Objectif : Utiliser les limites de quotas (stockage, membres) comme un moteur de vente organique au sein de l'application.
</context>

<instructions>
Mettez en place des indicateurs de consommation visuels.

Tâches :
1. Créez un composant `QuotaProgress` (barre de progression) pour le stockage et les membres.
2. Affichez ces indicateurs dans la barre latérale ou sur le Dashboard.
3. Implémentez un système de notification automatique (Toast ou Modal) dès que 80% d'un quota est atteint.
4. Ajoutez un bouton "Upgrade Now" contextuel qui redirige vers le checkout du plan supérieur.
</instructions>

<thinking>
- Comment calculer les quotas en temps réel sans ralentir chaque chargement de page (utiliser du cache ou des colonnes de décompte dans la DB) ?
- Quelle est la "fréquence de rappel" idéale pour ne pas agacer l'utilisateur tout en favorisant l'upsell ?
</thinking>

<critique_and_refine>
1. **Réponse Initiale** : Logique de calcul des quotas et UI.
2. **Critique Sceptique** : Analysez le risque de latence de la base de données lors des calculs de `COUNT(*)` complexes.
3. **Réponse Finale** : Système basé sur des "Counters" incrémentaux mis à jour via des hooks Lucid, garantissant des performances O(1) pour la lecture.
</critique_and_refine>
