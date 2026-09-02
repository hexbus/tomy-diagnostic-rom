# SPDX-License-Identifier: Apache-2.0
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $repoRoot "build.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$node = (Get-Command node -ErrorAction Stop).Source
$runner = Join-Path $repoRoot "tools\run_emulator.js"
$cases = @(
    @("tutor", "stock"),
    @("tutor", "tanam"),
    @("pyuuta", "stock"),
    @("pyuuta", "tanam")
)
foreach ($case in $cases) {
    $region = $case[0]
    $extension = $case[1]
    $image = Join-Path $repoRoot "build\$region-diag-16k.bin"
    $report = Join-Path $repoRoot "build\emulator-$region-$extension.json"
    & $node $runner $image $report $region $extension
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
$faultReport = Join-Path $repoRoot "build\emulator-tutor-vram-d7-stuck-low.json"
& $node $runner (Join-Path $repoRoot "build\tutor-diag-16k.bin") `
    $faultReport "tutor" "stock" "vram-d7-stuck-low"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$keyReport = Join-Path $repoRoot "build\emulator-pyuuta-key-shift.json"
& $node $runner (Join-Path $repoRoot "build\pyuuta-diag-16k.bin") `
    $keyReport "pyuuta" "stock" "none" "key-shift"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
foreach ($keyMode in @("key-equals", "key-plus", "key-zero-short", "key-zero-long", "key-layout-toggle")) {
    $keyModeReport = Join-Path $repoRoot "build\emulator-pyuuta-$keyMode.json"
    & $node $runner (Join-Path $repoRoot "build\pyuuta-diag-16k.bin") `
        $keyModeReport "pyuuta" "stock" "none" $keyMode
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
$systemReport = Join-Path $repoRoot "build\emulator-pyuuta-system-results.json"
& $node $runner (Join-Path $repoRoot "build\pyuuta-diag-16k.bin") `
    $systemReport "pyuuta" "stock" "none" "system-results"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$systemTanamReport = Join-Path $repoRoot "build\emulator-tutor-tanam-system-results.json"
& $node $runner (Join-Path $repoRoot "build\tutor-diag-16k.bin") `
    $systemTanamReport "tutor" "tanam" "none" "system-results"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$joystickReport = Join-Path $repoRoot "build\emulator-pyuuta-joystick-screen.json"
& $node $runner (Join-Path $repoRoot "build\pyuuta-diag-16k.bin") `
    $joystickReport "pyuuta" "stock" "none" "joystick-screen"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$chipReport = Join-Path $repoRoot "build\emulator-tutor-vram-chip-screen.json"
& $node $runner (Join-Path $repoRoot "build\tutor-diag-16k.bin") `
    $chipReport "tutor" "stock" "vram-d7-stuck-low" "chip-screen"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$marchWarningReport = Join-Path $repoRoot "build\emulator-pyuuta-march-warning.json"
& $node $runner (Join-Path $repoRoot "build\pyuuta-diag-16k.bin") `
    $marchWarningReport "pyuuta" "stock" "none" "march-warning"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$marchReport = Join-Path $repoRoot "build\emulator-pyuuta-march-once.json"
& $node $runner (Join-Path $repoRoot "build\pyuuta-diag-16k.bin") `
    $marchReport "pyuuta" "stock" "none" "march-once"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$marchStopReport = Join-Path $repoRoot "build\emulator-pyuuta-march-continuous-stop.json"
& $node $runner (Join-Path $repoRoot "build\pyuuta-diag-16k.bin") `
    $marchStopReport "pyuuta" "stock" "none" "march-continuous-stop"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$scrubReport = Join-Path $repoRoot "build\emulator-pyuuta-visible-scrub.json"
& $node $runner (Join-Path $repoRoot "build\pyuuta-diag-16k.bin") `
    $scrubReport "pyuuta" "stock" "none" "visible-scrub"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$musicStopReport = Join-Path $repoRoot "build\emulator-pyuuta-psg-interrupt.json"
& $node $runner (Join-Path $repoRoot "build\pyuuta-diag-16k.bin") `
    $musicStopReport "pyuuta" "stock" "none" "psg-interrupt"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$vdpReport = Join-Path $repoRoot "build\emulator-pyuuta-vdp-showcase.json"
& $node $runner (Join-Path $repoRoot "build\pyuuta-diag-16k.bin") `
    $vdpReport "pyuuta" "stock" "none" "vdp-showcase"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$musicReport = Join-Path $repoRoot "build\emulator-pyuuta-psg-music.json"
& $node $runner (Join-Path $repoRoot "build\pyuuta-diag-16k.bin") `
    $musicReport "pyuuta" "stock" "none" "psg-music"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$tanamReport = Join-Path $repoRoot "build\emulator-tutor-tanam-march.json"
& $node $runner (Join-Path $repoRoot "build\tutor-diag-16k.bin") `
    $tanamReport "tutor" "tanam" "none" "tanam-march"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$tanamStopReport = Join-Path $repoRoot "build\emulator-tutor-tanam-continuous-stop.json"
& $node $runner (Join-Path $repoRoot "build\tutor-diag-16k.bin") `
    $tanamStopReport "tutor" "tanam" "none" "tanam-continuous-stop"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$creditsReport = Join-Path $repoRoot "build\emulator-pyuuta-credits.json"
& $node $runner (Join-Path $repoRoot "build\pyuuta-diag-16k.bin") `
    $creditsReport "pyuuta" "stock" "none" "credits"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Output "All regional/map, menu acknowledgement, centered-title, credits, VRAM fault/chip drawing, native/PC key-view and held-key, independent controller, single/continuous RAM, VDP-scene, and complete/interrupted MegaDemo PSG tests passed"
