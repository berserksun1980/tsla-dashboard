const https = require('https');

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('Parse error: ' + data.slice(0, 100))); }
            });
        }).on('error', reject);
    });
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const data = await fetchJSON('https://api.exchangerate-api.com/v4/latest/USD');
        const rate = data.rates.CAD;
        res.json({ rate });
    } catch (e) {
        res.status(502).json({ error: e.message });
    }
};
