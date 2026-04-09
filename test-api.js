const { fetch } = require('undici');

// Try to access the local /api/unit/toko/laporan directly
async function test() {
    // We cannot easily inject a NextAuth session without a valid cookie.
    // However, we can look at the server logs or test similar logic.
}
test();
