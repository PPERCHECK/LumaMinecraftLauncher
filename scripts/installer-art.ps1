Add-Type -AssemblyName System.Drawing
$taskAssets = Join-Path $PSScriptRoot '..\build'
function New-LumaBitmap([int]$Width,[int]$Height,[string]$Name,[bool]$Sidebar) {
  $bitmap = New-Object System.Drawing.Bitmap($Width,$Height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $rect = New-Object System.Drawing.Rectangle(0,0,$Width,$Height)
  $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,[System.Drawing.Color]::FromArgb(16,16,22),[System.Drawing.Color]::FromArgb(62,42,88),80)
  $graphics.FillRectangle($gradient,$rect)
  $accent = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(198,171,255))
  $muted = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(166,154,187))
  $font = New-Object System.Drawing.Font('Segoe UI',24,[System.Drawing.FontStyle]::Bold)
  $small = New-Object System.Drawing.Font('Segoe UI',8)
  if ($Sidebar) {
    $points = [System.Drawing.PointF[]]@((New-Object System.Drawing.PointF(80,29)),(New-Object System.Drawing.PointF(89,53)),(New-Object System.Drawing.PointF(113,62)),(New-Object System.Drawing.PointF(89,71)),(New-Object System.Drawing.PointF(80,95)),(New-Object System.Drawing.PointF(71,71)),(New-Object System.Drawing.PointF(47,62)),(New-Object System.Drawing.PointF(71,53)))
    $graphics.FillPolygon($accent,$points)
    $graphics.DrawString('luma',$font,$accent,34,109)
    $graphics.DrawString('MINECRAFT JAVA',$small,$muted,28,157)
    $graphics.DrawString('YOUR WORLD.',$small,$muted,29,249)
    $graphics.DrawString('YOUR RULES.',$small,$accent,29,267)
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(85,70,111),1)
    for($i=0;$i -lt 5;$i++){$graphics.DrawLine($pen,20,199+$i*7,145,172+$i*10)}
    $pen.Dispose()
  } else { $graphics.DrawString('luma',$font,$accent,18,6) }
  $bitmap.Save((Join-Path $taskAssets $Name),[System.Drawing.Imaging.ImageFormat]::Bmp)
  $small.Dispose();$font.Dispose();$accent.Dispose();$muted.Dispose();$gradient.Dispose();$graphics.Dispose();$bitmap.Dispose()
}
New-LumaBitmap 164 314 'installer-sidebar.bmp' $true
New-LumaBitmap 150 57 'installer-header.bmp' $false
