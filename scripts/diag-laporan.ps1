$f = 'src\app\(protected)\unit\[unitSlug]\laporan\page.tsx'
$fullPath = (Resolve-Path -LiteralPath $f).Path
$c = [System.IO.File]::ReadAllText($fullPath)

# Diagnostic
Write-Host "Total chars: $($c.Length)"
Write-Host "PrintSummaryOld found: $(($c.IndexOf('Print Summary (Removed per feedback)')) -ge 0)"

# Find exact context around </TableBody> before </Table>
$idx = $c.IndexOf('</TableBody>')
while ($idx -ge 0) {
    $snippet = $c.Substring($idx, [Math]::Min(60, $c.Length - $idx))
    Write-Host "TableBody at $idx : $($snippet -replace "`r`n",' [CRLF] ' -replace "`n",' [LF] ')"
    $idx = $c.IndexOf('</TableBody>', $idx + 1)
}
