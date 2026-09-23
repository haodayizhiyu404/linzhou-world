Add-Type -AssemblyName System.Drawing
# 每个变体：裁滚动条全列 (x 270..286)，8x 放大，纵向拼接
$names = @('v1','v2','v3','v4','v5','v6')
$W = 16; $H = 520; $Z = 8
$out = New-Object System.Drawing.Bitmap ($W*$Z), (($H*$Z+6)*6)
$g = [System.Drawing.Graphics]::FromImage($out)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.Clear([System.Drawing.Color]::FromArgb(255,255,0,0))
foreach ($n in $names) {
  $idx = [array]::IndexOf($names, $n)
  $img = [System.Drawing.Image]::FromFile((Resolve-Path (".\sbv-" + $n + ".png")).Path)
  $dst = New-Object System.Drawing.Rectangle 0, (($H*$Z+6)*$idx), ($W*$Z), ($H*$Z)
  $src = New-Object System.Drawing.Rectangle 268, 0, $W, $H
  $g.DrawImage($img, $dst, $src, [System.Drawing.GraphicsUnit]::Pixel)
  $img.Dispose()
}
$out.Save((Join-Path (Get-Location) 'sbv-all.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $out.Dispose()
Write-Host 'done'
