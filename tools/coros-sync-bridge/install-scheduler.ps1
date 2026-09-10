param([Parameter(Mandatory=$true)][string]$Uid)
$ErrorActionPreference = 'Stop'
if ($Uid -notmatch '^[A-Za-z0-9_-]{1,128}$') { throw 'Invalid Firebase UID' }
$taskName = 'MyDash COROS Sync'
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) { throw 'COROS task already exists; inspect it before replacing.' }
$pythonExe = (& python -c 'import sys; print(sys.executable)').Trim()
$pythonWindowless = Join-Path (Split-Path $pythonExe) 'pythonw.exe'
if (!(Test-Path -LiteralPath $pythonWindowless)) { throw 'pythonw.exe unavailable' }
$syncScript = Join-Path $PSScriptRoot 'sync.py'
$action = New-ScheduledTaskAction -Execute $pythonWindowless -Argument ('"{0}" --uid {1} --days 9 --apply' -f $syncScript, $Uid) -WorkingDirectory $PSScriptRoot
$morning = New-ScheduledTaskTrigger -Daily -At '07:00'
$evening = New-ScheduledTaskTrigger -Daily -At '20:00'
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$logon = New-ScheduledTaskTrigger -AtLogOn -User $identity
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 20) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($morning,$evening) -Principal $principal -Settings $settings -Description 'COROS running splits to MyDash; encrypted login, nine-day overlap, daily at 07:00 and 20:00.' | Select-Object TaskName,State
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'Sync COROS to MyDash.lnk'
if (!(Test-Path -LiteralPath $shortcutPath)) {
    $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcutPath)
    $shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\schtasks.exe'
    $shortcut.Arguments = '/Run /TN "MyDash COROS Sync"'
    $shortcut.WindowStyle = 7
    $shortcut.Description = 'Sync COROS workouts and splits into MyDash now'
    $shortcut.Save()
}
$statusLink = Join-Path $desktop 'COROS Sync Status.lnk'
if (!(Test-Path -LiteralPath $statusLink)) {
    $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($statusLink)
    $shortcut.TargetPath = Join-Path $env:LOCALAPPDATA 'MyDash\coros-sync\status.html'
    $shortcut.Description = 'Last COROS sync result'
    $shortcut.Save()
}
