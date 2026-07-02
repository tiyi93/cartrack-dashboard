// server.js
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SERP_API_KEY = process.env.SERP_API_KEY;

console.log("🔑 SERP_API_KEY loaded:", SERP_API_KEY ? "YES (hidden)" : "NO - MISSING!");

app.use(express.static('public'));
app.use(express.json());

const dataDir = path.join(__dirname, 'public', 'data');
const jsonPath = path.join(dataDir, 'keywords-history.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(jsonPath)) fs.writeFileSync(jsonPath, JSON.stringify([], null, 2));

async function getEngineRanking(engine, keyword) {
    if (!SERP_API_KEY) {
        console.error(`❌ No API key for ${engine}`);
        return { rank: 15, aiStatus: "error", aiSnippet: "API key not configured", citationConfidence: "low" };
    }

    try {
        const res = await axios.get('https://serpapi.com/search', {
            params: { engine, q: keyword, api_key: SERP_API_KEY, gl: "za", hl: "en" }
        });

        const organic = res.data.organic_results || [];
        const cartrackPos = organic.findIndex(item => item.link && item.link.includes('cartrack.co.za')) + 1;

        return {
            rank: cartrackPos || 20,
            aiStatus: cartrackPos <= 3 ? "included" : cartrackPos <= 8 ? "cited" : "mentioned",
            aiSnippet: res.data.ai_overview?.text || "Cartrack fleet tracking solutions.",
            citationConfidence: cartrackPos <= 3 ? "high" : "medium"
        };
    } catch (e) {
        console.error(`Error ${engine}:`, e.message);
        return { rank: 15, aiStatus: "error", aiSnippet: "API call failed", citationConfidence: "low" };
    }
}

app.get('/api/refresh', async (req, res) => {
    const keyword = req.query.keyword || 'cartrack';
    console.log(`🔍 Fetching rankings for: ${keyword}`);

    const [google, bing] = await Promise.all([
        getEngineRanking('google', keyword),
        getEngineRanking('bing', keyword)
    ]);

    const record = {
        keyword: keyword.toLowerCase(),
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString('en-ZA'),
        time: new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }),
        googleRank: google.rank,
        bingRank: bing.rank,
        googleAiStatus: google.aiStatus,
        aiSnippet: google.aiSnippet,
        citationConfidence: google.citationConfidence
    };

    // Save to history
    const history = JSON.parse(fs.readFileSync(jsonPath, 'utf-8') || '[]');
    history.push(record);
    fs.writeFileSync(jsonPath, JSON.stringify(history, null, 2));

    res.json({ success: true, data: record });
});

app.get('/api/history', (req, res) => res.json(JSON.parse(fs.readFileSync(jsonPath, 'utf-8') || '[]')));
app.get('/api/latest', (req, res) => {
    const keyword = (req.query.keyword || 'cartrack').toLowerCase();
    const history = JSON.parse(fs.readFileSync(jsonPath, 'utf-8') || '[]');
    const latest = history.filter(r => r.keyword === keyword).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    res.json(latest || null);
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});