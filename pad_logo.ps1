Add-Type -AssemblyName System.Drawing

$logoPath = "d:\dev\web\gestaoequiperogerio\public\logo.png"
$pwaOutputDir = "d:\dev\web\gestaoequiperogerio\public\icons"
$resDir = "d:\dev\web\gestaoequiperogerio\android\app\src\main\res"

if (!(Test-Path $logoPath)) {
    Write-Error "Original logo.png not found at $logoPath!"
    exit 1
}

$logo = [System.Drawing.Image]::FromFile($logoPath)

# ──────────────────────────────────────────────────────────
# PART 1: PWA / Web Icon Generation
# ──────────────────────────────────────────────────────────
if (!(Test-Path $pwaOutputDir)) {
    New-Item -ItemType Directory -Force -Path $pwaOutputDir | Out-Null
}

function GeneratePwaIcon($size) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = "HighQuality"
    $g.InterpolationMode = "HighQualityBicubic"

    $g.Clear([System.Drawing.Color]::White)

    $pad = [int]($size * 0.20)
    $logoSize = $size - (2 * $pad)
    $g.DrawImage($logo, $pad, $pad, $logoSize, $logoSize)

    $outputPath = Join-Path $pwaOutputDir "icon-$size.png"
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "Generated PWA Icon: $outputPath"

    $g.Dispose()
    $bmp.Dispose()
}

Write-Host "Generating PWA icons..."
GeneratePwaIcon 512
GeneratePwaIcon 192
GeneratePwaIcon 180
GeneratePwaIcon 152

# ──────────────────────────────────────────────────────────
# PART 2: Android Mipmap (App Launcher) Icons
# ──────────────────────────────────────────────────────────
Write-Host "Generating Android launcher icons..."

# Helper to generate regular app launcher icon
function GenerateLauncherIcon($size, $outputPath) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = "HighQuality"
    $g.InterpolationMode = "HighQualityBicubic"

    # White background for solid standard icons
    $g.Clear([System.Drawing.Color]::White)

    $pad = [int]($size * 0.10)
    $logoSize = $size - (2 * $pad)
    $g.DrawImage($logo, $pad, $pad, $logoSize, $logoSize)

    $parentDir = [System.IO.Path]::GetDirectoryName($outputPath)
    if (!(Test-Path $parentDir)) {
        New-Item -ItemType Directory -Force -Path $parentDir | Out-Null
    }

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "Generated Launcher Icon: $outputPath (${size}x${size})"

    $g.Dispose()
    $bmp.Dispose()
}

# Helper to generate round app launcher icon
function GenerateRoundLauncherIcon($size, $outputPath) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = "HighQuality"
    $g.InterpolationMode = "HighQualityBicubic"

    $g.Clear([System.Drawing.Color]::Transparent)

    # Draw white circular backdrop
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.FillEllipse($brush, 0, 0, $size, $size)

    $pad = [int]($size * 0.15)
    $logoSize = $size - (2 * $pad)
    $g.DrawImage($logo, $pad, $pad, $logoSize, $logoSize)

    $parentDir = [System.IO.Path]::GetDirectoryName($outputPath)
    if (!(Test-Path $parentDir)) {
        New-Item -ItemType Directory -Force -Path $parentDir | Out-Null
    }

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "Generated Round Icon: $outputPath (${size}x${size})"

    $brush.Dispose()
    $g.Dispose()
    $bmp.Dispose()
}

# Helper to generate adaptive foreground launcher icon
function GenerateForegroundLauncherIcon($size, $outputPath) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = "HighQuality"
    $g.InterpolationMode = "HighQualityBicubic"

    $g.Clear([System.Drawing.Color]::Transparent)

    # Foreground adaptive icon is centered and scaled
    $logoSize = [int]($size * 0.65)
    $pad = [int](($size - $logoSize) / 2)
    $g.DrawImage($logo, $pad, $pad, $logoSize, $logoSize)

    $parentDir = [System.IO.Path]::GetDirectoryName($outputPath)
    if (!(Test-Path $parentDir)) {
        New-Item -ItemType Directory -Force -Path $parentDir | Out-Null
    }

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "Generated Foreground Icon: $outputPath (${size}x${size})"

    $g.Dispose()
    $bmp.Dispose()
}

$mipmaps = @(
    @{ folder = "mipmap-mdpi"; size = 48; fgSize = 108 },
    @{ folder = "mipmap-hdpi"; size = 72; fgSize = 162 },
    @{ folder = "mipmap-xhdpi"; size = 96; fgSize = 216 },
    @{ folder = "mipmap-xxhdpi"; size = 144; fgSize = 324 },
    @{ folder = "mipmap-xxxhdpi"; size = 192; fgSize = 432 }
)

foreach ($mipmap in $mipmaps) {
    $folderPath = Join-Path $resDir $mipmap.folder
    GenerateLauncherIcon $mipmap.size (Join-Path $folderPath "ic_launcher.png")
    GenerateRoundLauncherIcon $mipmap.size (Join-Path $folderPath "ic_launcher_round.png")
    GenerateForegroundLauncherIcon $mipmap.fgSize (Join-Path $folderPath "ic_launcher_foreground.png")
}

# ──────────────────────────────────────────────────────────
# PART 3: Android Splash Screens
# ──────────────────────────────────────────────────────────
Write-Host "Generating Android splash screens..."

# Helper function to generate centered logo on a solid white canvas
function GenerateSplash($width, $height, $outputPath) {
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = "HighQuality"
    $g.InterpolationMode = "HighQualityBicubic"

    $g.Clear([System.Drawing.Color]::White)

    # Scale logo size (e.g. 40% of the smaller dimension, bounding it gracefully)
    $smallerDim = [Math]::Min($width, $height)
    $logoSize = [int]($smallerDim * 0.40)
    if ($logoSize -lt 120) { $logoSize = 120 }
    if ($logoSize -gt $smallerDim) { $logoSize = $smallerDim }

    $x = [int](($width - $logoSize) / 2)
    $y = [int](($height - $logoSize) / 2)

    $g.DrawImage($logo, $x, $y, $logoSize, $logoSize)

    $parentDir = [System.IO.Path]::GetDirectoryName($outputPath)
    if (!(Test-Path $parentDir)) {
        New-Item -ItemType Directory -Force -Path $parentDir | Out-Null
    }

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "Generated Splash: $outputPath (${width}x${height})"

    $g.Dispose()
    $bmp.Dispose()
}

$splashes = @(
    @{ folder = "drawable"; w = 512; h = 512 },
    @{ folder = "drawable-port-mdpi"; w = 320; h = 480 },
    @{ folder = "drawable-port-hdpi"; w = 480; h = 800 },
    @{ folder = "drawable-port-xhdpi"; w = 720; h = 1280 },
    @{ folder = "drawable-port-xxhdpi"; w = 960; h = 1600 },
    @{ folder = "drawable-port-xxxhdpi"; w = 1280; h = 1920 },
    @{ folder = "drawable-land-mdpi"; w = 480; h = 320 },
    @{ folder = "drawable-land-hdpi"; w = 800; h = 480 },
    @{ folder = "drawable-land-xhdpi"; w = 1280; h = 720 },
    @{ folder = "drawable-land-xxhdpi"; w = 1600; h = 960 },
    @{ folder = "drawable-land-xxxhdpi"; w = 1920; h = 1280 }
)

foreach ($splash in $splashes) {
    $folderPath = Join-Path $resDir $splash.folder
    GenerateSplash $splash.w $splash.h (Join-Path $folderPath "splash.png")
}

$logo.Dispose()
Write-Host "All assets generated successfully!"
