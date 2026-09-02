# SPDX-License-Identifier: Apache-2.0
param(
    [string]$AssemblerPath = $env:XAS99_PATH,
    [string]$PythonPath = $env:TOMY_DIAG_PYTHON
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$outputDirectory = Join-Path $repoRoot "build"
$pythonArguments = @()
if (-not $AssemblerPath) { $AssemblerPath = Join-Path $repoRoot "..\xdt99\xas99.py" }
if (-not $PythonPath) {
    $launcher = Get-Command py -ErrorAction SilentlyContinue
    if ($launcher) {
        $PythonPath = $launcher.Source
        $pythonArguments = @("-3")
    }
}
if (-not $PythonPath) {
    $command = Get-Command python -ErrorAction SilentlyContinue
    if ($command) { $PythonPath = $command.Source }
}
if (-not $PythonPath) { throw "Install Python 3 or pass -PythonPath" }
if (-not (Test-Path -LiteralPath $AssemblerPath)) { throw "Missing xdt99 assembler: $AssemblerPath" }

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$commonSource = Join-Path $repoRoot "src\diag.a99"
$sourceLines = Get-Content -LiteralPath $commonSource
for ($i = 0; $i -lt $sourceLines.Count - 1; $i++) {
    if ($sourceLines[$i] -match '^([A-Z0-9]+)\s+byte\s+(\d+)\s*$') {
        $label = $Matches[1]
        $declaredLength = [int]$Matches[2]
        if ($sourceLines[$i + 1] -match "text '([^']*)'") {
            $actualLength = $Matches[1].Length
            if ($declaredLength -ne $actualLength) {
                throw "$label declares $declaredLength bytes but contains $actualLength characters"
            }
        }
    }
}

# Every framed page heading must fit inside the 30-column interior, use mixed
# case, and go through PUTTTL so its start column is calculated from its length.
$topTitleLabels = @(
    'BRANDT', 'INPTTL', 'KBDTTL', 'JOYTTL', 'VRLTTL', 'VRWTTL', 'VRSCTT',
    'VRSCRT', 'VRDTTL', 'VRDRTTL', 'CHIPTT', 'TANTTL', 'TANRNG', 'TANRTT',
    'MUSTTL', 'VDPDTL', 'VDPRTL', 'SYSRTT', 'CREDTT'
)
foreach ($titleLabel in $topTitleLabels) {
    $definition = -1
    for ($i = 0; $i -lt $sourceLines.Count - 1; $i++) {
        if ($sourceLines[$i] -match "^$titleLabel\s+byte\s+(\d+)\s*$") {
            $definition = $i
            break
        }
    }
    if ($definition -lt 0 -or $sourceLines[$definition + 1] -notmatch "text '([^']*)'") {
        throw "Missing framed-title definition for $titleLabel"
    }
    $titleText = $Matches[1]
    if ($titleText.Length -gt 30) { throw "$titleLabel is wider than the framed page interior" }
    if ($titleText -ceq $titleText.ToUpperInvariant()) {
        throw "$titleLabel must use mixed/title case rather than all caps"
    }
    $centeredCall = $false
    for ($i = 0; $i -lt $sourceLines.Count - 1; $i++) {
        if ($sourceLines[$i] -match "^\s*li\s+r1,$titleLabel\s*$" -and
            $sourceLines[$i + 1] -match '^\s*bl\s+@PUTTTL\s*$') {
            $centeredCall = $true
            break
        }
    }
    if (-not $centeredCall) { throw "$titleLabel is not drawn through PUTTTL" }
}

foreach ($table in @(
    [ordered]@{ Name = 'KEYNAM'; Width = 16 },
    [ordered]@{ Name = 'KEYSHF'; Width = 8 },
    [ordered]@{ Name = 'PCNAM'; Width = 8 },
    [ordered]@{ Name = 'PCSHF'; Width = 8 }
)) {
    $keyLabels = @()
    $inKeyTable = $false
    foreach ($line in $sourceLines) {
        if ($line -match "^$($table.Name)\s*$") { $inKeyTable = $true; continue }
        if ($inKeyTable -and ($line -match '^[A-Z0-9]+\s*$' -or $line -match '^\s+even\s*$')) { break }
        if ($inKeyTable -and $line -match "text '([^']*)'") { $keyLabels += $Matches[1] }
    }
    if ($keyLabels.Count -ne 64) {
        throw "$($table.Name) contains $($keyLabels.Count) labels, expected 64"
    }
    foreach ($label in $keyLabels) {
        if ($label.Length -ne $table.Width) {
            throw "$($table.Name) label '$label' is $($label.Length) bytes, expected $($table.Width)"
        }
    }
}

function Finalize-Rom {
    param([string]$Path)
    $bytes = [IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -ne 0x4000) { throw "$Path is $($bytes.Length) bytes, expected 16384" }
    $bytes[0x3ffc] = 0
    $bytes[0x3ffd] = 0
    [uint32]$sum = 0
    for ($i = 0; $i -lt 0x4000; $i += 2) {
        [uint32]$word = ([uint32]$bytes[$i] * 256) + [uint32]$bytes[$i + 1]
        $sum = ($sum + $word) % 65536
    }
    [uint16]$fix = ((0x10000 - $sum) -band 0xffff)
    $bytes[0x3ffc] = ($fix -shr 8) -band 0xff
    $bytes[0x3ffd] = $fix -band 0xff
    [IO.File]::WriteAllBytes($Path, $bytes)

    [uint32]$verify = 0
    for ($i = 0; $i -lt 0x4000; $i += 2) {
        [uint32]$word = ([uint32]$bytes[$i] * 256) + [uint32]$bytes[$i + 1]
        $verify = ($verify + $word) % 65536
    }
    if ($verify -ne 0) { throw "Runtime word checksum did not finalize to zero" }
}

$targets = @(
    [ordered]@{ region = "tutor"; source = "src\t_diag.a99" },
    [ordered]@{ region = "pyuuta"; source = "src\p_diag.a99" }
)
$manifestBuilds = @()
foreach ($target in $targets) {
    $sourcePath = Join-Path $repoRoot $target.source
    $corePath = Join-Path $outputDirectory "$($target.region)-diag-16k.bin"
    $listingPath = Join-Path $outputDirectory "$($target.region)-diag-16k.lst"
    Push-Location (Split-Path -Parent $sourcePath)
    try {
        & $PythonPath @pythonArguments $AssemblerPath -B -R -X -L $listingPath -o $corePath $sourcePath
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    } finally {
        Pop-Location
    }
    Finalize-Rom -Path $corePath
    $coreBytes = [IO.File]::ReadAllBytes($corePath)
    if ($coreBytes[0] -ne 0xF0 -or $coreBytes[1] -ne 0xA0) {
        throw "$($target.region) reset workspace is not >F0A0"
    }
    if ($coreBytes[0x3ffe] -ne 0xD1 -or $coreBytes[0x3fff] -ne 0xA6) {
        throw "$($target.region) build marker is missing"
    }
    $programmerPath = Join-Path $outputDirectory "$($target.region)-diag-w27c512.bin"
    $programmerBytes = New-Object byte[] 0x10000
    for ($bank = 0; $bank -lt 4; $bank++) {
        [Array]::Copy($coreBytes, 0, $programmerBytes, $bank * 0x4000, 0x4000)
    }
    [IO.File]::WriteAllBytes($programmerPath, $programmerBytes)
    $manifestBuilds += [ordered]@{
        region = $target.region
        core = [IO.Path]::GetFileName($corePath)
        core_bytes = 16384
        core_sha256 = (Get-FileHash -LiteralPath $corePath -Algorithm SHA256).Hash.ToLowerInvariant()
        runtime_word_sum = ">0000"
        w27c512 = [IO.Path]::GetFileName($programmerPath)
        w27c512_bytes = 65536
        w27c512_sha256 = (Get-FileHash -LiteralPath $programmerPath -Algorithm SHA256).Hash.ToLowerInvariant()
        layout = "four identical 16 KiB quarters at >0000, >4000, >8000, >C000"
    }
}

$manifest = [ordered]@{
    schema = "tomy-diagnostic-rom-build-v1"
    version = "1.0"
    build_date_label = "2026"
    builds = $manifestBuilds
}
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $outputDirectory "manifest.json") -Encoding utf8

$sumLines = foreach ($file in Get-ChildItem -LiteralPath $outputDirectory -File |
        Where-Object { $_.Extension -eq '.bin' -or $_.Name -eq 'manifest.json' } |
        Sort-Object Name) {
    "{0}  {1}" -f (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant(), $file.Name
}
Set-Content -LiteralPath (Join-Path $outputDirectory "SHA256SUMS.txt") -Value $sumLines -Encoding ascii
Write-Output "Built Tutor and Pyuuta 16 KiB diagnostic cores and repeated W27C512 layouts in $outputDirectory"
