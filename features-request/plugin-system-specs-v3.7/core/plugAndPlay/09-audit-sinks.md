# 09 — Audit Sinks (export/forward) (plugAndPlay)
**Classification:** plugAndPlay  
**Depends on**: **03-audit-events**  
**Mandatory for** : —

---

## Goal
Forward audit events to external systems (Datadog/Splunk/S3 WORM, etc.) via `AuditSink` providers.

---

## Requirements
- Sink failures must not block requests
- Retry with backoff (queue recommended)
- Per-tenant sink configuration

---

## Toggle behavior
- Off: stop exporting
- On: validate sink config and health

---

End of document.
