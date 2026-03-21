param(
    [string]$PackageName = "dev.shivarya.expensetracker",
    [switch]$AlsoUninstallApp,
    [switch]$Aggressive
)

$ErrorActionPreference = "Stop"

function Invoke-Adb {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Device,
        [Parameter(Mandatory = $true)]
        [string]$Command
    )

    & adb -s $Device shell $Command | Out-Host
}

try {
    & adb start-server | Out-Host
} catch {
    Write-Error "adb was not found. Install Android platform-tools and ensure adb is in PATH."
    exit 1
}

$deviceLines = & adb devices
$emulators = @()

foreach ($line in $deviceLines) {
    if ($line -match '^(emulator-[0-9]+)\s+device$') {
        $emulators += $Matches[1]
    }
}

if ($emulators.Count -eq 0) {
    Write-Error "No running emulator found. Start an emulator first, then rerun this script."
    exit 1
}

foreach ($emu in $emulators) {
    Write-Host "`n=== Cleaning $emu ===" -ForegroundColor Cyan

    # Ask Android package manager to trim cache as much as possible.
    Invoke-Adb -Device $emu -Command 'pm trim-caches 128G'

    # Remove common temp/media cache folders from shared storage.
    Invoke-Adb -Device $emu -Command 'rm -rf /sdcard/Download/*'
    Invoke-Adb -Device $emu -Command 'rm -rf /sdcard/DCIM/.thumbnails/*'
    Invoke-Adb -Device $emu -Command 'rm -rf /sdcard/Android/data/*/cache/*'

    # Clear runtime cache for app package if installed.
    if ($PackageName -and $PackageName.Trim() -ne "") {
        Write-Host "Clearing app data for: $PackageName" -ForegroundColor Yellow
        Invoke-Adb -Device $emu -Command "pm clear $PackageName"

        if ($AlsoUninstallApp) {
            Write-Host "Uninstalling app package: $PackageName" -ForegroundColor Yellow
            & adb -s $emu uninstall $PackageName | Out-Host
        }
    }

    if ($Aggressive) {
        Write-Host "Running aggressive cleanup (safe for emulator, but removes user app data)." -ForegroundColor Yellow

        # Clear a few heavy preinstalled app caches/data.
        $heavyPackages = @(
            'com.android.chrome',
            'com.google.android.youtube',
            'com.google.android.apps.maps'
        )

        foreach ($pkg in $heavyPackages) {
            Invoke-Adb -Device $emu -Command "pm clear $pkg"
        }
    }

    Write-Host "Cleanup finished for $emu" -ForegroundColor Green
}

Write-Host "`nDone. Rebuild/install again:" -ForegroundColor Green
Write-Host 'cd "c:\Users\Ash\Documents\Projects\apps\expense-tracker\mobile" ; npm run android'
