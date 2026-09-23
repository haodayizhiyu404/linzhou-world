Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile((Resolve-Path '.\preview.png').Path)
# 主屏微信图标: phone1 内 (55,535)-(85,565) 约 30px
$W = 34; $H = 34; $Z = 10
$out = New-Object System.Drawing.Bitmap ($W*$Z), ($H*$Z)
$g = [System.Drawing.Graphics]::FromImage($out)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$src = New-Object System.Drawing.Rectangle 52, 532, $W, $H
$dst = New-Object System.Drawing.Rectangle 0, 0, ($W*$Z), ($H*$Z)
$g.DrawImage($img, $dst, $src, [System.Drawing.GraphicsUnit]::Pixel)
$out.Save((Join-Path (Get-Location) 'icon-check.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $out.Dispose(); $img.Dispose()
Write-Host 'done'
