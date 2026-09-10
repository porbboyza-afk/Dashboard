param([string]$Uid = '4QrRDDXHyEN4TGJ4MCoLav5BK6D3')
$ErrorActionPreference = 'Stop'
if ($env:COMPUTERNAME -ne 'PORDELL') { throw 'This migration installer is for PORDELL only.' }
if ($Uid -notmatch '^[A-Za-z0-9_-]{1,128}$') { throw 'Invalid UID' }
if (Get-ScheduledTask -TaskName 'MyDash COROS Sync' -ErrorAction SilentlyContinue) { throw 'Existing COROS task found. Inspect it before changing it.' }
$pythonExe = (& python -c 'import sys, win32crypt; print(sys.executable)').Trim()
if ($LASTEXITCODE -ne 0 -or !$pythonExe) { throw 'Python with pywin32 is required.' }
$firebaseCommand = Get-Command firebase.cmd -ErrorAction SilentlyContinue
if (!$firebaseCommand) { throw 'Firebase CLI is required for this Windows user.' }
$destination = Join-Path $env:LOCALAPPDATA 'MyDash\coros-bridge'
if (Test-Path -LiteralPath $destination) { throw 'Installation folder already exists; inspect before replacing.' }
New-Item -ItemType Directory -Path $destination | Out-Null
foreach ($name in @('connect.py','sync.py','install-scheduler.ps1','README.md')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination (Join-Path $destination $name)
}
Push-Location $destination
try {
    $runtime = Join-Path $env:LOCALAPPDATA 'MyDash\coros-sync'
    if (!(Test-Path -LiteralPath (Join-Path $runtime 'token.enc'))) {
        $loginUrl = & $pythonExe connect.py login-start
        if ($LASTEXITCODE -ne 0) { throw 'COROS login could not start.' }
        $loginUri = [uri]($loginUrl | Select-Object -Last 1)
        if ($loginUri.Scheme -ne 'https' -or ($loginUri.Host -ne 'coros.com' -and !$loginUri.Host.EndsWith('.coros.com'))) { throw 'Unexpected login URL.' }
        Start-Process $loginUri.AbsoluteUri
        Read-Host 'Complete COROS authorization in the browser, then press Enter'
        & $pythonExe connect.py login-finish
        if ($LASTEXITCODE -ne 0) { throw 'COROS authorization is not complete.' }
    }
    & $pythonExe sync.py --uid $Uid --days 9
    if ($LASTEXITCODE -ne 0) { throw 'Dry-run failed; check Firebase login and COROS connection.' }
    & $pythonExe sync.py --uid $Uid --days 9 --apply
    if ($LASTEXITCODE -ne 0) { throw 'Initial sync failed; scheduler not installed.' }
    & (Join-Path $destination 'install-scheduler.ps1') -Uid $Uid
    Start-ScheduledTask -TaskName 'MyDash COROS Sync'
    Write-Host 'COROS task installed and started. Verify its completed result and status HTML before disabling ADMIN task.'
} finally { Pop-Location }
