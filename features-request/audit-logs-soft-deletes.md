# Feature Request: Audit Logs & Soft Deletes for B2B Reliability

<context>
Vous êtes un Expert en Sécurité et Intégrité des Données. Dans un contexte SaaS B2B, la suppression accidentelle de données par des membres d'équipe est un risque majeur.
Pile technique : AdonisJS 6 (Lucid ORM), PostgreSQL.
</context>

<instructions>
Mettez en place une stratégie de protection et de traçabilité des données.

Tâches :
1. Implémentez le support des **Soft Deletes** sur les modèles principaux (Teams, Projects, Documents) en utilisant un mixin Lucid.
2. Créez un système d'**Audit Logs** robuste qui enregistre l'auteur, l'action, la ressource et l'horodatage pour chaque modification sensible.
3. Développez un middleware ou un hook global pour capturer automatiquement ces événements sans polluer les contrôleurs.
</instructions>

<thinking>
- Doit-on enregistrer le "diff" des données (avant/après) ou juste l'action ?
- Comment s'assurer que les logs d'audit eux-mêmes ne peuvent pas être supprimés par un admin de team malveillant ?
- Impact sur les performances de la base de données après 1 million de logs ?
</thinking>

<critique_and_refine>
1. **Réponse Initiale** : Schémas de migration et implémentation des hooks.
2. **Critique Sceptique** : Identifiez les risques de saturation de stockage et les problèmes de conformité RGPD (droit à l'oubli vs logs d'audit).
3. **Réponse Finale** : Solution optimisée avec partitionnement de table pour les logs et politique de rétention automatique.
</critique_and_refine>
