$f = 'src\app\(protected)\unit\[unitSlug]\laporan\page.tsx'
$fullPath = (Resolve-Path -LiteralPath $f).Path
$c = [System.IO.File]::ReadAllText($fullPath)
$crlf = "`r`n"

# ── FIX 1: timezone tx.date ──────────────────────────────────────────────────
$old1 = 'toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit" })'
$new1 = 'toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Asia/Jakarta" })'
$c = $c.Replace($old1, $new1)
Write-Host "Fix1 tx.date TZ: $(($c.IndexOf('Asia/Jakarta')) -ge 0)"

# ── FIX 2: timezone exp.date (plain, no options) ─────────────────────────────
$old2 = 'new Date(exp.date).toLocaleDateString("id-ID")'
$new2 = 'new Date(exp.date).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })'
$beforeFix2 = ($c.Split($old2)).Length - 1
$c = $c.Replace($old2, $new2)
Write-Host "Fix2 exp.date TZ: replaced $($beforeFix2) occurrence(s)"

# ── FIX 3: TableFooter in transactions — print:hidden ────────────────────────
$old3 = '<TableFooter>'
$new3 = '<TableFooter className="print:hidden">'
$c = $c.Replace($old3, $new3)
Write-Host "Fix3 TFoot hide: $(($c.IndexOf('print:hidden')) -ge 0)"

# ── FIX 4: Add Print Summary div (before Breakdown Metode Bayar) ─────────────
# Anchor: the comment "{/* ── Breakdown Metode Bayar (screen)"
$anchor4 = '            {/* ── Breakdown Metode Bayar (screen)'
$printSummaryBlock = @"
            {/* ── Print Summary (only on print, appears once after transactions) */}
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

"@
# Convert LF to CRLF in the here-string (PS here-strings use LF)
$printSummaryBlock = $printSummaryBlock -replace "(?<!\r)\n", "`r`n"
$c = $c.Replace($anchor4, $printSummaryBlock + $anchor4)
Write-Host "Fix4 PrintSummary: $(($c.IndexOf('hidden print:grid')) -ge 0)"

# ── FIX 5: Add Total Pengeluaran footer to expense table ─────────────────────
# Exact pattern from diagnostic: </TableBody>[CRLF]                        </Table>
$old5 = "</TableBody>$crlf                        </Table>"
$new5 = "</TableBody>$crlf                            <TableFooter className=""print:hidden"">$crlf                                <TableRow className=""bg-red-50 font-bold"">$crlf                                    <TableCell colSpan={isAdmin ? 4 : 3} className=""text-right"">TOTAL PENGELUARAN OPERASIONAL</TableCell>$crlf                                    <TableCell className=""text-right tabular-nums text-red-700 font-bold"">$crlf                                        {formatCurrency(expenses.reduce((s, e) => s + e.amount, 0))}$crlf                                    </TableCell>$crlf                                    {isAdmin && <TableCell className=""print:hidden"" />}$crlf                                </TableRow>$crlf                            </TableFooter>$crlf                        </Table>"
$c = $c.Replace($old5, $new5)
Write-Host "Fix5 ExpenseTotal: $(($c.IndexOf('TOTAL PENGELUARAN OPERASIONAL')) -ge 0)"

# ── Write back ────────────────────────────────────────────────────────────────
[System.IO.File]::WriteAllText($fullPath, $c, [System.Text.Encoding]::UTF8)

# ── Final verification ─────────────────────────────────────────────────────────
$linesAfter = (Get-Content -LiteralPath $f | Measure-Object -Line).Lines
Write-Host ""
Write-Host "=== DONE | Lines: $linesAfter (base=978, expected ~1010) ==="
