Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile((Resolve-Path '.\preview.png').Path)
$Z = 6
# 三块: user语音条(phone3), NPC语音条(phone3), 滚动条(phone2)
$regions = @(
  @(840, 138, 140, 42),   # user voice
  @(755, 183, 210, 46),   # npc voice (open)
  @(655, 120, 24, 290)    # scrollbar phone2
)
$Hs = @(42, 46, 290)
$outW = 0
for ($i = 0; $i -lt 3; $i++) { $outW += $regions[$i][2]*$Z + 10 }
$outH = 290*$Z
$out = New-Object System.Drawing.Bitmap $outW, $outH
$g = [System.Drawing.Graphics]::FromImage($out)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.Clear([System.Drawing.Color]::FromArgb(255,255,0,255))
$xoff = 0
for ($i = 0; $i -lt 3; $i++) {
  $c = $regions[$i]
  $dst = New-Object System.Drawing.Rectangle $xoff, 0, ($c[2]*$Z), ($c[3]*$Z)
  $src = New-Object System.Drawing.Rectangle $c[0], $c[1], $c[2], $c[3]
  $g.DrawImage($img, $dst, $src, [System.Drawing.GraphicsUnit]::Pixel)
  $xoff += $c[2]*$Z + 10
}
$out.Save((Join-Path (Get-Location) 'preview-check.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $out.Dispose(); $img.Dispose()
Write-Host 'done'
