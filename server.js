#!/usr/bin/env node
/**
 * Local proxy server for TSLA Dashboard.
 * Serves index.html and proxies stock/FX requests so the browser
 * avoids CORS restrictions on external APIs.
 *
 * Usage:  node server.js
 * Then open: http://localhost:3000
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT = 3000;

// ── helpers ──────────────────────────────────────────────────────────────────

function fetchJSON(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const opts = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json',
                ...headers,
            },
        };
        https.get(url, opts, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('JSON parse error: ' + data.slice(0, 200))); }
            });
        }).on('error', reject);
    });
}

function sendJSON(res, statusCode, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
    });
    res.end(body);
}

// ── route handlers ────────────────────────────────────────────────────────────

async function handleStock(res) {
    try {
        const url = 'https://query1.finance.yahoo.com/v8/finance/chart/TSLA?interval=1d&range=1d';
        const data = await fetchJSON(url);
        const price = data.chart.result[0].meta.regularMarketPrice;
        sendJSON(res, 200, { price });
    } catch (e) {
        console.error('[/api/stock]', e.message);
        sendJSON(res, 502, { error: e.message });
    }
}

async function handleFX(res) {
    try {
        const url = 'https://api.exchangerate-api.com/v4/latest/USD';
        const data = await fetchJSON(url);
        const rate = data.rates.CAD;
        sendJSON(res, 200, { rate });
    } catch (e) {
        console.error('[/api/fx]', e.message);
        sendJSON(res, 502, { error: e.message });
    }
}

function handleFile(res, filePath, contentType) {
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
}

// ── server ────────────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];

    if (url === '/api/stock') return handleStock(res);
    if (url === '/api/fx')    return handleFX(res);

    // Static files
    const staticMap = {
        '/':            ['index.html',       'text/html'],
        '/index.html':  ['index.html',       'text/html'],
    };

    if (staticMap[url]) {
        const [file, mime] = staticMap[url];
        return handleFile(res, path.join(__dirname, file), mime);
    }

    res.writeHead(404);
    res.end('Not found');
});

server.listen(PORT, () => {
    console.log(`TSLA Dashboard proxy running → http://localhost:${PORT}`);
    console.log('  /api/stock  — live TSLA price (Yahoo Finance)');
    console.log('  /api/fx     — live USD/CAD rate');
    console.log('\nPress Ctrl+C to stop.');
});
