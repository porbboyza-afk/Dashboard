# MyDash Garmin Direct Bridge (Phase 0)

Windows-only, local, read-only capability probe. It does not write Firebase, alter Coach data, run a scheduler, or bulk-download FIT files.

```powershell
python -m pip install -e .
mydash-garmin login
mydash-garmin probe --days 7
mydash-garmin probe --days 30 --include-fit
```

The Garmin password is used only for interactive login. The resulting session is encrypted with Windows DPAPI Current User scope under `%LOCALAPPDATA%\MyDash\garmin-direct`.

