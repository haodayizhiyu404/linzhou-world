Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile((Resolve-Path '.\sb.png').Path)
$starts = @(16,339,662,985,1308,1631)
$W = 24; $H = 44; $Z = 8
$out = New-Object System.Drawing.Bitmap (($W*$Z+10)*6), (($H*$Z+10)*2)
$g = [System.Drawing.Graphics]::FromImage($out)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.Clear([System.Drawing.Color]::FromArgb(255,180,180,180))
for ($i = 0; $i -lt 6; $i++) {
  $sx = $starts[$i] + 280 - 10
  $dst = New-Object System.Drawing.Rectangle ((($W*$Z+10)*$i), 0, ($W*$Z), ($H*$Z))
  $src = New-Object System.Drawing.Rectangle $sx, 36, $W, $H
  $g.DrawImage($img, $dst, $src, [System.Drawing.GraphicsUnit]::Pixel)
  $dst2 = New-Object System.Drawing.Rectangle ((($W*$Z+10)*$i), ($H*$Z+10), ($W*$Z), ($H*$Z))
  $src2 = New-Object System.Drawing.Rectangle $sx, 456, $W, $H
  $g.DrawImage($img, $dst2, $src2, [System.Drawing.GraphicsUnit]::Pixel)
}
$out.Save((Join-Path (Get-Location) 'sb-ends.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $out.Dispose(); $img.Dispose()
Write-Host 'done'
