Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile((Resolve-Path '.\preview.png').Path)
# 手机2(chat) 与 手机4(staged)：屏幕右缘滚动条
$crops = @(
  @(655, 120, 30, 290),   # phone2 chat body 全高
  @(1348, 120, 30, 290)   # phone4 chat body 全高
)
$W = 30; $H = 290; $Z = 6
$out = New-Object System.Drawing.Bitmap (($W*$Z+8)*2), ($H*$Z)
$g = [System.Drawing.Graphics]::FromImage($out)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.Clear([System.Drawing.Color]::FromArgb(255,255,0,255))
for ($i = 0; $i -lt 2; $i++) {
  $c = $crops[$i]
  $dst = New-Object System.Drawing.Rectangle ((($W*$Z+8)*$i)), 0, ($W*$Z), ($H*$Z)
  $src = New-Object System.Drawing.Rectangle $c[0], $c[1], $c[2], $c[3]
  $g.DrawImage($img, $dst, $src, [System.Drawing.GraphicsUnit]::Pixel)
}
$out.Save((Join-Path (Get-Location) 'preview-sb.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $out.Dispose(); $img.Dispose()
Write-Host 'done'
