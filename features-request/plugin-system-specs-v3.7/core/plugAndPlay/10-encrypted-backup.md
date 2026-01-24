# 10 — Encrypted Backups (plugAndPlay)
**Classification:** plugAndPlay  
**Depends on**: **05-at-rest-encryption**  
**Mandatory for** : —

---

## Goal
Encrypt database exports/backups using the configured KeyProvider for purpose `backup`.

This feature is independent from whether live data is encrypted at rest; it reuses the same key management abstraction.

---

## Requirements
- Encrypt backups client-side in the backup job (not via filesystem tricks)
- Include backup metadata: tenant scope, timestamp, schema version
- Provide restore workflow that validates key availability

---

## Toggle behavior
- Off: backups may be disabled or unencrypted depending on policy (prefer: disable)
- On: requires valid KeyProvider for purpose `backup`

---

End of document.
