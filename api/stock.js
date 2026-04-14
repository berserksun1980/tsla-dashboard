const https = require('https');

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
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
        const data = await fetchJSON(
            'https://query1.finance.yahoo.com/v8/finance/chart/TSLA?interval=1d&range=1d'
        );
        const price = data.chart.result[0].meta.regularMarketPrice;
        res.json({ price });
    } catch (e) {
        res.status(502).json({ error: e.message });
    }
};
