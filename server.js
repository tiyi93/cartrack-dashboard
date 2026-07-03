// server.js
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SERP_API_KEY = process.env.SERP_API_KEY;

app.use(express.static('public'));
app.use(express.json());

const dataDir = path.join(__dirname, 'public', 'data');
const jsonPath = path.join(dataDir, 'keywords-history.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(jsonPath)) fs.writeFileSync(jsonPath, JSON.stringify([], null, 2));

async function getRankings(keyword) {
    let googleRank = 20, bingRank = 20, aiSnippet = "No AI overview available.";

    try {
        // Google
        const googleRes = await axios.get('https://serpapi.com/search', {
            params: { engine: "google", q: keyword, api_key: SERP_API_KEY, gl: "za", hl: "en", num: 15 }
        });
        const gOrganic = googleRes.data.organic_results || [];
        googleRank = gOrganic.findIndex(item => item.link && item.link.includes('cartrack.co.za')) + 1 || 20;
        aiSnippet = googleRes.data.ai_overview?.text || aiSnippet;
    } catch (e) { console.error("Google error:", e.message); }

    try {
        // Bing
        const bingRes = await axios.get('https://serpapi.com/search', {
            params: { engine: "bing", q: keyword, api_key: SERP_API_KEY, gl: "za", hl: "en" }
        });
        const bOrganic = bingRes.data.organic_results || [];
        bingRank = bOrganic.findIndex(item => item.link && item.link.includes('cartrack.co.za')) + 1 || 20;
    } catch (e) { console.error("Bing error:", e.message); }

    return {
        googleRank: googleRank,
        bingRank: bingRank,
        volume: "N/A", // Can be added via DataForSEO later
        difficulty: "N/A",
        aiSnippet: aiSnippet,
        citationConfidence: googleRank <= 5 ? "high" : "medium"
    };
}

app.get('/api/refresh', async (req, res) => {
    const keyword = req.query.keyword || 'cartrack';
    const data = await getRankings(keyword);

    const record = {
        keyword: keyword.toLowerCase(),
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString('en-ZA'),
        time: new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }),
        ...data
    };

    const history = JSON.parse(fs.readFileSync(jsonPath, 'utf-8') || '[]');
    history.push(record);
    fs.writeFileSync(jsonPath, JSON.stringify(history, null, 2));

    res.json({ success: true, data: record });
});

app.get('/api/history', (req, res) => res.json(JSON.parse(fs.readFileSync(jsonPath, 'utf-8') || '[]')));

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));