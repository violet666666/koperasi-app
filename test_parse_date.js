const monthMap = {
    'JAN': 0, 'JANUARI': 0,
    'FEB': 1, 'FEBRUARI': 1, 'F3B': 1,
    'MAR': 2, 'MRT': 2, 'MARET': 2,
    'APR': 3, 'APRIL': 3,
    'MEI': 4,
    'JUN': 5, 'JUNI': 5,
    'JUL': 6, 'JULI': 6,
    'AGS': 7, 'AGUSTUS': 7, 'AGU': 7,
    'SEP': 8, 'SEPT': 8, 'SEPTEMBER': 8,
    'OKT': 9, 'OKTOBER': 9,
    'NOV': 10, 'NOVEMBER': 10,
    'DES': 11, 'DESEMBER': 11
};

function parseIndonesianDate(dateStr) {
    if (!dateStr) return null;
    let cleanStr = String(dateStr).trim().toUpperCase();
    if (!cleanStr) return null;

    if (!isNaN(Number(cleanStr))) {
        const serial = Number(cleanStr);
        if (serial > 10000 && serial < 100000) {
            const excelEpoch = new Date(Math.round((serial - 25569) * 86400 * 1000));
            return excelEpoch;
        }
    }

    const parts = cleanStr.split(/[\s\-/,]+/);
    if (parts.length === 0) return null;

    let day = 1;
    let month = -1;
    let year = -1;

    for (const part of parts) {
        if (/^\d{4}$/.test(part)) {
            year = parseInt(part, 10);
        } else if (/^\d{1,2}$/.test(part)) {
            const val = parseInt(part, 10);
            if (val > 12 || (val <= 12 && month !== -1 && day === 1 && val > 0)) { 
                day = val;
            } else if (val <= 12 && month === -1 && year !== -1) {
                month = val - 1;
            } else if (val <= 12 && month === -1) {
                day = val;
            }
        } else {
            for (const [key, val] of Object.entries(monthMap)) {
                if (part.includes(key)) {
                    month = val;
                    break;
                }
            }
        }
    }

    if (year === -1) return null;
    if (month === -1) month = 0;

    return new Date(Date.UTC(year, month, day));
}

console.log(parseIndonesianDate(" 29 JUL 2025 "));
console.log(parseIndonesianDate(" 10 JAN 2023 "));
console.log(parseIndonesianDate(" 4 F3B 2023 "));
console.log(parseIndonesianDate(" OKT 2019 "));
console.log(parseIndonesianDate(" "));
console.log(parseIndonesianDate(" 45123 ")); // Some Excel serial number
