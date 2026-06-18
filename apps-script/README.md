# Google Apps Script backend

1. Create a Google Sheet.
2. Open **Extensions → Apps Script** and replace `Code.gs` with this repository's `Code.gs`.
3. Add Script Properties:
   - `MYDASH_SHEET_ID`
   - `MYDASH_BACKUP_TOKEN`
4. Deploy as a Web App, execute as yourself, and copy the `/exec` URL.
5. Enter the URL and matching token in MyDash Settings.

When this file changes, create a **new Apps Script deployment version** so the live `/exec` endpoint uses the new schema.
