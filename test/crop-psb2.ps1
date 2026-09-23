Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile((Resolve-Path '.\preview.png').Path)
# 顶端 y120-170 与底端 y360-410，x655-678，10x
$W = 23; $H = 50; $Z = 10
$out = New-Object System.Drawing.Bitmap (($W*$Z+8)*2), (($H*$Z+8)*2)
$g = [System.Drawing.Graphics]::FromImage($out)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.Clear([System.Drawing.Color]::FromArgb(255,255,0,255))
$dstT = New-Object System.Drawing.Rectangle 0, 0, ($W*$Z), ($H*$Z)
$srcT = New-Object System.Drawing.Rectangle 655, 120, $W, $H
$g.DrawImage($img, $dstT, $srcT, [System.Drawing.GraphicsUnit]::Pixel)
$dstB = New-Object System.Drawing.Rectangle 0, ($H*$Z+8), ($W*$Z), ($H*$Z)
$srcB = New-Object System.Drawing.Rectangle 655, 360, $W, $H
$g.DrawImage($img, $dstB, $srcB, [System.Drawing.GraphicsUnit]::Pixel)
# 手机4 同样位置：x + 693
$dstT2 = New-Object System.Drawing.Rectangle ($W*$Z+8), 0, ($W*$Z), ($H*$Z)
$srcT2 = New-Object System.Drawing.Rectangle 1348, 120, $W, $H
$g.DrawImage($img, $dstT2, $srcT2, [System.Drawing.GraphicsUnit]::Pixel)
$dstB2 = New-Object System.Drawing.Rectangle ($W*$Z+8), ($H*$Z+8), ($W*$Z), ($H*$Z)
$srcB2 = New-Object System.Drawing.Rectangle 1348, 360, $W, $H
$g.DrawImage($img, $dstB2, $srcB2, [System.Drawing.GraphicsUnit]::Pixel)
$out.Save((Join-Path (Get-Location) 'preview-sbends.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $out.Dispose(); $img.Dispose()
Write-Host 'done'
