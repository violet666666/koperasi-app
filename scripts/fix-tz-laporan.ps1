$f = 'src\app\(protected)\unit\[unitSlug]\laporan\page.tsx'
$c = Get-Content -LiteralPath $f -Raw

# Fix 1: tx.date — tambah timeZone WIB
$c = $c -replace 'toLocaleDateString\("id-ID", \{ day: "2-digit", month: "2-digit", year: "2-digit" \}\)', 'toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Asia/Jakarta" })'

# Fix 2: exp.date — tambah timeZone WIB (versi tanpa options)
$c = $c -replace 'new Date\(exp\.date\)\.toLocaleDateString\("id-ID"\)', 'new Date(exp.date).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })'

Set-Content -LiteralPath $f -Value $c -NoNewline
Write-Host "TZ fix applied to laporan/page.tsx"
