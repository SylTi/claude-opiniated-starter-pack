# 05 — At-rest Encryption (DEK + KeyProvider wrapping) (toConf)
**Classification:** toConf  
**Depends on**: **01-tenancy**  
**Mandatory for** : **06-byok**, **10-encrypted-backup**

---

## Goal
Encrypt sensitive data at rest using:
- per-record **DEKs** (data keys)
- a **KeyProvider** that wraps/unwraps DEKs

Rule: data is encrypted **once**; switching providers affects only DEK wrapping.

---

## Default provider (per deployment)
`ServerManagedKeyProvider`:
- one master key (MK) per deployment (KMS/HSM recommended)
- wraps DEKs for purposes `at-rest` and `backup`

---

## Data model pattern (per encrypted field)
Store:
- `ciphertext`
- `wrapped_dek`
- `key_ref` (provider id + key id + version)
- `algo/version`

Use AAD that binds ciphertext to:
- `tenantId`
- record id
- field name

---

## Provider selection
- One active KeyProvider per purpose:
  - purpose `at-rest` (required if feature enabled)
  - purpose `backup` (reused; can be same provider)

---

## Rotation and migrations (explicit workflows)
- Rotation is never implicit.
- Re-wrapping DEKs is allowed without decrypting plaintext (provider-dependent).
- Disabling after data is encrypted requires a controlled decrypt/migrate path.

---

End of document.
