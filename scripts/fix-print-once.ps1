$f = 'src\app\(protected)\unit\[unitSlug]\laporan\page.tsx'
$fullPath = (Resolve-Path -LiteralPath $f).Path
$c = [System.IO.File]::ReadAllText($fullPath)
$nl = "`r`n"

# ── FIX A: Insert print-total-tx block BEFORE "{/* ── Operational Expenses Table"
# We use a simpler anchor without em-dashes: find "Operational Expenses Table" comment
$anchorA = "            {/* " + [char]0x2500 + [char]0x2500 + " Operational Expenses Table"
# Fallback: search for the expenses conditional
$anchorA2 = "            {/* `u{2500}`u{2500} Operational Expenses Table"

# Use a safe anchor: the line that starts with "{expenses.length > 0 &&"
$anchorA3 = "            {expenses.length > 0 && ("
$blockA = @"
            {/* Print-only: Total Pendapatan once at end of transactions */}${nl}            {transactions.length > 0 && summary && (${nl}                <div className="hidden print:block border-t-2 border-black pt-2 mt-1 mb-4">${nl}                    <table className="w-full text-sm">${nl}                        <tbody>${nl}                            <tr className="font-bold">${nl}                                <td className="py-1 text-right pr-4">TOTAL PENDAPATAN</td>${nl}                                <td className="py-1 text-right tabular-nums">{formatCurrency(summary.totalPendapatan)}</td>${nl}                            </tr>${nl}                        </tbody>${nl}                    </table>${nl}                </div>${nl}            )}${nl}            {expenses.length > 0 && (${nl}
"@

if ($c.Contains($anchorA3)) {
    $c = $c.Replace($anchorA3, $blockA)
    Write-Host "Fix A OK - inserted tx print total before expense section"
} else {
    Write-Host "Fix A FAILED - anchor not found"
}

# ── FIX B: Insert print-total-exp block AFTER expense </Card> + before </div>
# Anchor: the closing pattern of expense section before Lampiran comment
# Look for "</Card>`r`n                </div>`r`n            )}" after expense table
$anchorB = "</Card>${nl}                </div>${nl}            )}"
$blockB = "</Card>${nl}                {/* Print-only: Total Pengeluaran once at end */}${nl}                {expenses.length > 0 && (${nl}                    <div className=""hidden print:block border-t-2 border-red-700 pt-2 mt-1 mb-2 text-sm"">${nl}                        <table className=""w-full"">${nl}                            <tbody>${nl}                                <tr className=""font-bold"">${nl}                                    <td className=""py-1 text-right pr-4"">TOTAL PENGELUARAN OPERASIONAL</td>${nl}                                    <td className=""py-1 text-right tabular-nums text-red-800"">{formatCurrency(expenses.reduce((s, e) => s + e.amount, 0))}</td>${nl}                                </tr>${nl}                            </tbody>${nl}                        </table>${nl}                    </div>${nl}                )}${nl}                </div>${nl}            )}"

if ($c.Contains($anchorB)) {
    $c = $c.Replace($anchorB, $blockB)
    Write-Host "Fix B OK - inserted expense print total"
} else {
    Write-Host "Fix B FAILED"
    Write-Host "Looking for pattern..."
    $idx = $c.IndexOf("</Card>")
    while ($idx -ge 0) {
        $s = $c.Substring($idx, [Math]::Min(80, $c.Length - $idx)) -replace "`r`n", " [NL] "
        Write-Host "  Card@$idx : $s"
        $idx = $c.IndexOf("</Card>", $idx + 1)
    }
}

# ── FIX C: Remove misplaced print summary grid (hidden print:grid block)
# Find it by simpler unique string
$startMarker = "hidden print:grid grid-cols-4"
$idx = $c.IndexOf($startMarker)
if ($idx -ge 0) {
    # Walk back to find "{summary && ("
    $walkBack = $c.LastIndexOf("{summary && (", $idx)
    # Walk forward to find closing ")}"
    $walkFwd = $c.IndexOf(")}", $idx)
    if ($walkBack -ge 0 -and $walkFwd -ge 0) {
        $walkFwd += 2  # include "})"
        $c = $c.Substring(0, $walkBack) + $c.Substring($walkFwd)
        Write-Host "Fix C OK - removed misplaced print summary grid"
    } else {
        Write-Host "Fix C FAILED - could not find boundaries"
    }
} else {
    Write-Host "Fix C SKIP - no print grid found"
}

# ── Write back
[System.IO.File]::WriteAllText($fullPath, $c, [System.Text.Encoding]::UTF8)
$lines = (Get-Content -LiteralPath $f | Measure-Object -Line).Lines
Write-Host "=== Done | Lines: $lines ==="
