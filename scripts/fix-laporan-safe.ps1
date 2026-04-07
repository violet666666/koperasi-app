$f = 'src\app\(protected)\unit\[unitSlug]\laporan\page.tsx'
$path = (Resolve-Path -LiteralPath $f).Path
$lines = [System.IO.File]::ReadAllLines($path)

Write-Host "Lines before: $($lines.Length)"

# Hapus lines 558-574 (index 557-573): orphaned print summary remnants
# Ini adalah sisa dari Fix C yang gagal memotong block secara parsial
$removeStart = 557  # 0-based (line 558)
$removeEnd   = 573  # 0-based inclusive (line 574)

# Verifikasi konten yang akan dihapus
Write-Host "--- Akan dihapus (index $removeStart - $removeEnd) ---"
for ($i = $removeStart; $i -le $removeEnd; $i++) {
    Write-Host "$($i+1): $($lines[$i])"
}
Write-Host "---"

$output = [System.Collections.Generic.List[string]]::new()
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($i -ge $removeStart -and $i -le $removeEnd) { continue }
    $output.Add($lines[$i])
}

[System.IO.File]::WriteAllLines($path, $output, [System.Text.Encoding]::UTF8)
Write-Host "Lines after: $(([System.IO.File]::ReadAllLines($path)).Length)"
Write-Host "Done!"
