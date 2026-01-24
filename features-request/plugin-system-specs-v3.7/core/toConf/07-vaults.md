# 07 — Vaults (Client-side E2EE) (toConf)
**Classification:** toConf  
**Depends on**: **01-tenancy**, **02-rbac-core**  
**Mandatory for** : —

---

## Goal
Provide an E2EE “vault” where the server stores ciphertext only, and the client holds keys.

This is distinct from:
- at-rest encryption (server decrypts)
- BYOK (server decrypts; provider controls wrapping)

---

## Constraints
- Server cannot index/search plaintext inside vault unless you design specialized schemes.
- Recovery is a product decision (recovery keys, escrow, etc.).
- Disabling vaults requires explicit export/decrypt workflow; otherwise users lose access.

---

## Client flows
- Key derivation (passphrase / device key)
- Encrypt on client, send ciphertext
- Decrypt on client after fetch

---

## Server behavior
- Treat vault payload as opaque bytes
- Enforce RBAC + tenancy for access
- Audit reads/writes (metadata only)

---

End of document.
