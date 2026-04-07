$f = 'src\app\(protected)\unit\[unitSlug]\laporan\page.tsx'
$fullPath = (Resolve-Path -LiteralPath $f).Path
$c = [System.IO.File]::ReadAllText($fullPath)

# ── FIX 1: timezone tx.date ─────────────────────────────────────────────────
$c = $c -replace (
    [regex]::Escape('toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit" })'),
    'toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Asia/Jakarta" })'
)

# ── FIX 2: timezone exp.date (without options) ───────────────────────────────
# matches: new Date(exp.date).toLocaleDateString("id-ID")
$c = $c -replace (
    [regex]::Escape('new Date(exp.date).toLocaleDateString("id-ID")'),
    'new Date(exp.date).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })'
)

# Also fix receipt print section same pattern
# Already covered by Fix 2 above (same string)

# ── FIX 3: TableFooter in transactions table — print:hidden ─────────────────
# So it doesn't repeat on every print page
$c = $c -replace (
    [regex]::Escape('<TableFooter>'),
    '<TableFooter className="print:hidden">'
)

# ── FIX 4: User's Print Summary (Removed comment → real div) ────────────────
$old4 = '            {/* ── Print Summary (Removed per feedback) ────────────────────────────── */}'
$new4 = @'
            {/* ── Print Summary (only on print, appears once at end of transactions) */}
            {summary && (
                <div className="hidden print:grid grid-cols-4 gap-3 mb-4 text-sm">
                    <div className="border rounded p-2 text-center">
                        <p className="text-xs text-gray-500">Total Pendapatan</p>
                        <p className="font-bold">{formatCurrency(summary.totalPendapatan)}</p>
                    </div>
                    <div className="border rounded p-2 text-center">
                        <p className="text-xs text-gray-500">Tunai</p>
                        <p className="font-bold">{formatCurrency(summary.tunai)}</p>
                    </div>
                    <div className="border rounded p-2 text-center">
                        <p className="text-xs text-gray-500">QRIS</p>
                        <p className="font-bold">{formatCurrency(summary.qris)}</p>
                    </div>
                    <div className="border rounded p-2 text-center">
                        <p className="text-xs text-gray-500">Potong Gaji</p>
                        <p className="font-bold">{formatCurrency(summary.potongGaji)}</p>
                    </div>
                </div>
            )}
'@
$c = $c.Replace($old4, $new4)

# ── FIX 5: Add Total Pengeluaran footer to expense table ────────────────────
$old5 = '                            </TableBody>
                        </Table>'
$new5 = @'
                            </TableBody>
                            <TableFooter>
                                <TableRow className="bg-red-50 font-bold">
                                    <TableCell colSpan={isAdmin ? 4 : 3} className="text-right">TOTAL PENGELUARAN OPERASIONAL</TableCell>
                                    <TableCell className="text-right tabular-nums text-red-700 font-bold">
                                        {formatCurrency(expenses.reduce((s, e) => s + e.amount, 0))}
                                    </TableCell>
                                    {isAdmin && <TableCell className="print:hidden" />}
                                </TableRow>
                            </TableFooter>
                        </Table>
'@
$c = $c.Replace($old5, $new5)

# ── Write back correctly (preserves CRLF) ───────────────────────────────────
[System.IO.File]::WriteAllText($fullPath, $c, [System.Text.Encoding]::UTF8)

# ── Verify ───────────────────────────────────────────────────────────────────
$lines = (Get-Content -LiteralPath $f | Measure-Object -Line).Lines
$tzOk   = ($c -match 'timeZone.*Asia/Jakarta')
$tfoot  = ($c -match 'TableFooter.*print:hidden')
$expFt  = ($c -match 'TOTAL PENGELUARAN OPERASIONAL.*TableCell')
$printS = ($c -match 'hidden print:grid')

Write-Host "Lines      : $lines  (expected ~1010)"
Write-Host "TZ fix     : $tzOk"
Write-Host "TFoot hide : $tfoot"
Write-Host "Exp total  : $expFt"
Write-Host "Print summ : $printS"
