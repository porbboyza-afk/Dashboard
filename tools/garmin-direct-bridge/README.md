# MyDash Garmin Direct Bridge

Windows-only Garmin collector and MyDash Firebase synchronizer. Garmin access is read-only; Firebase writes are deterministic under the authenticated MyDash UID.

```powershell
python -m pip install -e .
mydash-garmin login
mydash-garmin probe --days 7
mydash-garmin probe --days 30 --include-fit
mydash-garmin auto-sync --uid <firebase-uid> --wellness-days 3
mydash-garmin scheduler-install --uid <firebase-uid> --project-root C:\Users\pucca\Dashboard-GitHub
mydash-garmin scheduler-status
```

The Garmin password is used only for interactive login. The resulting session is encrypted with Windows DPAPI Current User scope under `%LOCALAPPDATA%\MyDash\garmin-direct`.

The installed tasks run daily at 09:00 and 21:00 with `StartWhenAvailable` and `IgnoreNew`. Automatic writes use Firebase CLI login state and verify `sync_sources/garmin_direct` after each successful update.
