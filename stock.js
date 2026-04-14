const https = require('https');

function fetchURL(url, options = {}) {
    return new Promise((resolve, reject) => {
        const opts = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json, text/plain, */*',
                ...options.headers,
            },
            timeout: 6000,
        };
        const req = https.get(url, opts, (res) => {
            // Follow redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchURL(res.headers.location, options).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
}

// Source 1: Yahoo Finance chart API
async function tryYahooV8() {
    const { body } = await fetchURL(
        'https://query1.finance.yahoo.com/v8/finance/chart/TSLA?interval=1d&range=1d'
    );
    const data = JSON.parse(body);
    const price = data.chart.result[0].meta.regularMarketPrice;
    if (!price) throw new Error('No price in Yahoo v8 response');
    return price;
}

// Source 2: Yahoo Finance query2 (different server pool)
async function tryYahooV8Q2() {
    const { body } = await fetchURL(
        'https://query2.finance.yahoo.com/v8/finance/chart/TSLA?interval=1d&range=1d'
    );
    const data = JSON.parse(body);
    const price = data.chart.result[0].meta.regularMarketPrice;
    if (!price) throw new Error('No price in Yahoo q2 response');
    return price;
}

// Source 3: Stooq (free, no key, works from cloud)
async function tryStooq() {
    const { body } = await fetchURL('https://stooq.com/q/l/?s=tsla.us&f=sd2t2ohlcv&h&e=csv');
    // CSV format: Symbol,Date,Time,Open,High,Low,Close,Volume
    const lines = body.trim().split('\n');
    const cols = lines[1].split(',');
    const price = parseFloat(cols[6]); // Close price
    if (!price || isNaN(price)) throw new Error('No price in Stooq response');
    return price;
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');

    const sources = [
        { name: 'yahoo-q1', fn: tryYahooV8 },
        { name: 'yahoo-q2', fn: tryYahooV8Q2 },
        { name: 'stooq',    fn: tryStooq },
    ];

    const errors = [];
    for (const source of sources) {
        try {
            const price = await source.fn();
            return res.json({ price, source: source.name });
        } catch (e) {
            errors.push(`${source.name}: ${e.message}`);
        }
    }

    res.status(502).json({ error: 'All sources failed', details: errors });
};
