$f = 'src\app\(protected)\unit\[unitSlug]\laporan\page.tsx'
$lines = Get-Content -LiteralPath $f

# Cari baris "</TableBody>" yang diikuti "</Table>" di section expense (baris ~874)
# Kita insert TableFooter expense setelah "</TableBody>" di baris itu
$insertAfterLine = -1

for ($i = 860; $i -lt [Math]::Min($i+50, $lines.Length); $i++) {
    if ($lines[$i] -match '^\s+</TableBody>') {
        # Pastikan ini ada di section expense (bukan transaksi) - cek baris sebelumnya mengandung expense rows
        $insertAfterLine = $i
        break
    }
}

# Fallback: cari dari baris 870
if ($insertAfterLine -lt 0) {
    for ($i = 870; $i -lt 880; $i++) {
        if ($lines[$i] -match '^\s+</TableBody>') {
            $insertAfterLine = $i
            break
        }
    }
}

if ($insertAfterLine -ge 0) {
    $indent = "                        " # 24 spaces matching expense table indent
    $newLines = @()
    for ($i = 0; $i -lt $lines.Length; $i++) {
        $newLines += $lines[$i]
        if ($i -eq $insertAfterLine) {
            $newLines += "${indent}<TableFooter>"
            $newLines += "${indent}    <TableRow className=""bg-red-50 font-bold"">"
            $newLines += "${indent}        <TableCell colSpan={isAdmin ? 4 : 3} className=""text-right"">TOTAL PENGELUARAN OPERASIONAL</TableCell>"
            $newLines += "${indent}        <TableCell className=""text-right tabular-nums text-red-700 font-bold"">"
            $newLines += "${indent}            {formatCurrency(expenses.reduce((s, e) => s + e.amount, 0))}"
            $newLines += "${indent}        </TableCell>"
            $newLines += "${indent}        {isAdmin && <TableCell className=""print:hidden"" />}"
            $newLines += "${indent}    </TableRow>"
            $newLines += "${indent}</TableFooter>"
            Write-Host "Inserted TableFooter after line $($insertAfterLine + 1)"
        }
    }
    Set-Content -LiteralPath $f -Value $newLines -NoNewline
    Write-Host "Done"
} else {
    Write-Host "ERROR: Could not find </TableBody> in expense section"
}
