# Interdependencies (No silent break policy)

## Policy rules (hard requirements)
1) **Tenant is mandatory**: there is no “tenant off” mode.
2) If a feature lists `**Depends on**: X`, then:
   - enabling it requires X enabled/configured
   - disabling X **must automatically disable** the dependent feature(s)
3) If a feature lists `**Mandatory for** : Y`, then:
   - Y cannot be enabled unless this feature is enabled
   - disabling this feature **must disable Y**

---

## Feature graph (overview)

### Mandatory
- **01-tenancy**
- **02-rbac-core**
- **03-audit-events** (curated audit emitter + event schema)

### ToConf (configuration-time, not a casual toggle)
- **04-sso** (may lock out users; must be configured deliberately)
- **05-at-rest-encryption** (crypto framework + default ServerManagedKeyProvider)
- **06-byok** (KeyProvider replacement for 05; requires deliberate setup)
- **07-vaults** (client-side E2EE; not reversible without explicit export/decrypt workflow)

### PlugAndPlay (admin toggle, with cascade rules)
- **08-audit-log** (persistence + UI)
- **09-audit-sinks** (export/forward)
- **10-encrypted-backup** (backup encryption pipeline)
- **11-rbac-extensions** (optional rule packs)
- **12-dlp** (schema-aware redaction)

---

## Dependency table (authoritative)

- **01-tenancy**
  - Depends on: —
  - Mandatory for: everything tenant-scoped (i.e., essentially all features)

- **02-rbac-core**
  - Depends on: 01-tenancy
  - Mandatory for: 04-sso, 11-rbac-extensions, 12-dlp

- **03-audit-events**
  - Depends on: 01-tenancy
  - Mandatory for: 08-audit-log, 09-audit-sinks, 12-dlp

- **04-sso**
  - Depends on: 01-tenancy, 02-rbac-core
  - Mandatory for: —
  - Notes: enabling SSO should keep at least one break-glass admin auth path.

- **05-at-rest-encryption**
  - Depends on: 01-tenancy
  - Mandatory for: 06-byok (provider), 10-encrypted-backup (key wrapping)

- **06-byok**
  - Depends on: 05-at-rest-encryption
  - Mandatory for: —
  - Notes: cannot be enabled unless provider is validated.

- **07-vaults**
  - Depends on: 01-tenancy, 02-rbac-core
  - Mandatory for: —
  - Notes: E2EE data must remain decryptable by the user; disabling requires explicit export/decrypt.

- **08-audit-log**
  - Depends on: 03-audit-events
  - Mandatory for: —
  - Notes: turning off does not break core, but reduces compliance visibility.

- **09-audit-sinks**
  - Depends on: 03-audit-events
  - Mandatory for: —
  - Notes: sink failures must not block requests.

- **10-encrypted-backup**
  - Depends on: 05-at-rest-encryption
  - Mandatory for: —
  - Notes: encryption keys come from KeyProvider; backup is independent from live encryption usage.

- **11-rbac-extensions**
  - Depends on: 02-rbac-core
  - Mandatory for: —
  - Notes: deny-overrides composition; must be deterministic.

- **12-dlp**
  - Depends on: 02-rbac-core, 03-audit-events
  - Mandatory for: —
  - Notes: redaction must preserve schema shapes; never regex-replace raw bodies.

---

End of document.
