# 12 — DLP / Redaction (plugAndPlay)
**Classification:** plugAndPlay  
**Depends on**: **02-rbac-core**, **03-audit-events**  
**Mandatory for** : —

---

## Goal
Provide schema-aware redaction on outbound responses for compliance.

---

## Hard constraints
- No regex replace on raw bodies.
- Redaction must preserve schema shapes.
- Redaction decisions must be auditable.

---

## Integration point
Apply redaction at the serialization layer:
- before response is sent
- after authorization
- with a typed “shape id” (so plugins don’t guess)

---

## Toggle behavior
- Off: no redaction (compliance regression; require admin warning)
- On: validate policies; failures fail closed for sensitive endpoints

---

End of document.
