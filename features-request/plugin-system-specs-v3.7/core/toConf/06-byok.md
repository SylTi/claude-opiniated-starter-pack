# 06 — BYOK KeyProvider (KMS/Vault/CMK) (toConf)
**Classification:** toConf  
**Depends on**: **05-at-rest-encryption**  
**Mandatory for** : —

---

## Goal
Allow enterprises to supply their own key management system for DEK wrapping:
- AWS KMS
- HashiCorp Vault Transit
- Azure Key Vault / GCP KMS (later)

BYOK does not double-encrypt data. It replaces the wrapping provider for DEKs.

---

## Requirements
- Provider must implement `KeyProvider` contract.
- Provider must validate connectivity/config on enablement.
- Key refs must be stable and auditable.

---

## Migration strategy (from server-managed to BYOK)
Preferred:
- Re-wrap stored DEKs from ServerManaged → BYOK without decrypting plaintext (if possible)
Fallback:
- Decrypt + re-encrypt (expensive; avoid)

---

## Disable/rollback
Treat as a controlled operation:
- rotate/re-wrap DEKs back to ServerManagedKeyProvider
- do not allow casual toggling

---

End of document.
