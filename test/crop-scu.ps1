Add-Type -AssemblyName System.Drawing
$files = @('sbv-t-widthonly.png','sbv-t-color.png')
$W = 20; $H = 50; $Z = 8
$out = New-Object System.Drawing.Bitmap (($W*$Z+8)*2), (($H*$Z+8)*2)
$g = [System.Drawing.Graphics]::FromImage($out)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.Clear([System.Drawing.Color]::FromArgb(255,255,0,255))
foreach ($f in $files) {
  $idx = [array]::IndexOf($files, $f)
  $img = [System.Drawing.Image]::FromFile((Resolve-Path (".\" + $f)).Path)
  $dstT = New-Object System.Drawing.Rectangle ((($W*$Z+8)*$idx)), 0, ($W*$Z), ($H*$Z)
  $srcT = New-Object System.Drawing.Rectangle 266, 0, $W, $H
  $g.DrawImage($img, $dstT, $srcT, [System.Drawing.GraphicsUnit]::Pixel)
  $dstB = New-Object System.Drawing.Rectangle ((($W*$Z+8)*$idx)), ($H*$Z+8), ($W*$Z), ($H*$Z)
  $srcB = New-Object System.Drawing.Rectangle 266, 470, $W, $H
  $g.DrawImage($img, $dstB, $srcB, [System.Drawing.GraphicsUnit]::Pixel)
  $img.Dispose()
}
$out.Save((Join-Path (Get-Location) 'sbv-tw.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $out.Dispose()
Write-Host 'done'
