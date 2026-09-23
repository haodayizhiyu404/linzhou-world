Add-Type -AssemblyName System.Drawing
$names = @('v1','v2','v3','v4','v5','v6')
$W = 20; $H = 50; $Z = 8
$out = New-Object System.Drawing.Bitmap (($W*$Z+8)*6), (($H*$Z+8)*2)
$g = [System.Drawing.Graphics]::FromImage($out)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.Clear([System.Drawing.Color]::FromArgb(255,255,0,255))
foreach ($n in $names) {
  $idx = [array]::IndexOf($names, $n)
  $img = [System.Drawing.Image]::FromFile((Resolve-Path (".\sbv-" + $n + ".png")).Path)
  $dstT = New-Object System.Drawing.Rectangle ((($W*$Z+8)*$idx)), 0, ($W*$Z), ($H*$Z)
  $srcT = New-Object System.Drawing.Rectangle 266, 0, $W, $H
  $g.DrawImage($img, $dstT, $srcT, [System.Drawing.GraphicsUnit]::Pixel)
  $dstB2 = New-Object System.Drawing.Rectangle ((($W*$Z+8)*$idx)), ($H*$Z+8), ($W*$Z), ($H*$Z)
  $srcB = New-Object System.Drawing.Rectangle 266, 470, $W, $H
  $g.DrawImage($img, $dstB2, $srcB, [System.Drawing.GraphicsUnit]::Pixel)
  $img.Dispose()
}
$out.Save((Join-Path (Get-Location) 'sbv-ends.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $out.Dispose()
Write-Host 'done'
