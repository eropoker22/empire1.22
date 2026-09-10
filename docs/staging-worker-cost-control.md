# Staging worker cost control

These commands target only the canonical `empire-streets-staging-worker` Fly app.

Pause staging only after confirming that no staging match is in progress:

```powershell
$env:EMPIRE_RELEASE_ENVIRONMENT = "staging"
npm run staging:pause-worker
```

Resume before staging gameplay or acceptance testing:

```powershell
$env:EMPIRE_RELEASE_ENVIRONMENT = "staging"
npm run staging:resume-worker
```

The helper rejects a non-staging release environment, a different `FLY_STAGING_APP`,
and any production-like app name. It never targets the production Fly application.
