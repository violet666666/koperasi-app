$f = 'src\app\(protected)\unit\[unitSlug]\laporan\page.tsx'
$c = Get-Content -LiteralPath $f -Raw

# ── Fix 1: TableFooter TOTAL PENDAPATAN - sembunyikan dari print (print:hidden)
# sehingga tidak repeat di setiap halaman cetak.
# Ganti TableFooter jadi print:hidden — total akan ditampilkan di print summary div
$c = $c -replace '<TableFooter>', '<TableFooter className="print:hidden">'

# ── Fix 2: Tambahkan Total Pengeluaran di tabel expense sebelum </Table>
$old2 = '                        </Table>
                    </CardContent>
                </Card>
                </div>
            )}'

$new2 = '                        <TableFooter>
                            <TableRow className="bg-red-50 font-bold print:hidden">
                                <TableCell colSpan={isAdmin ? 5 : 4} className="text-right">TOTAL PENGELUARAN</TableCell>
                                <TableCell className="text-right tabular-nums text-red-700">
                                    {formatCurrency(expenses.reduce((s, e) => s + e.amount, 0))}
                                </TableCell>
                                {isAdmin && <TableCell className="print:hidden" />}
                            </TableRow>
                        </TableFooter>
                        </Table>
                    </CardContent>
                </Card>
                {/* Total Pengeluaran — cetak saja, muncul sekali di akhir */}
                <div className="hidden print:block mt-2 text-right text-sm font-bold border-t-2 border-black pt-2">
                    TOTAL PENGELUARAN OPERASIONAL: {formatCurrency(expenses.reduce((s, e) => s + e.amount, 0))}
                </div>
                </div>
            )}'

$c = $c.Replace($old2, $new2)

Set-Content -LiteralPath $f -Value $c -NoNewline
Write-Host "Print total fix applied"
