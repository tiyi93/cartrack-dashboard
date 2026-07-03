// server.js
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const SERP_API_KEY = process.env.SERP_API_KEY;
const APIFY_API_KEY = process.env.APIFY_API_KEY;   // Optional for Volume + Competitors

app.use(express.static('public'));
app.use(express.json());

const dataDir = path.join(__dirname, 'public', 'data');
const jsonPath = path.join(dataDir, 'keywords-history.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(jsonPath)) fs.writeFileSync(jsonPath, JSON.stringify([], null, 2));

async function getSerpData(keyword) {
    try {
        const res = await axios.get('https://serpapi.com/search', {
            params: { engine: "google", q: keyword, api_key: SERP_API_KEY, gl: "za", hl: "en", num: 15 }
        });
        const organic = res.data.organic_results || [];
        const googleRank = organic.findIndex(item => item.link && item.link.includes('cartrack.co.za')) + 1 || 20;

        return {
            googleRank,
            bingRank: 15, // Can add Bing later
            aiSnippet: res.data.ai_overview?.text || "Cartrack fleet tracking solutions.",
            citationConfidence: googleRank <= 5 ? "high" : "medium"
        };
    } catch (e) {
        return { googleRank: 15, bingRank: 15, aiSnippet: "Live data unavailable.", citationConfidence: "low" };
    }
}

async function getVolumeAndCompetitors(keyword) {
    if (!APIFY_API_KEY) return { volume: 'N/A', difficulty: 'N/A', competitors: [] };

    try {
        // Simple Apify call for metrics
        const res = await axios.post(`https://api.apify.com/v2/acts/apify~google-search-scraper/runs?token=${APIFY_API_KEY}`, {
            queries: [keyword],
            countryCode: "za"
        });

        // For now, return placeholder (you can expand)
        return {
            volume: "12.5K",
            difficulty: 45,
            competitors: [
                { name: "Tracker SA", rank: 4 },
                { name: "MiX Telematics", rank: 7 },
                { name: "Netstar", rank: 9 }
            ]
        };
    } catch (e) {
        return { volume: 'N/A', difficulty: 'N/A', competitors: [] };
    }
}

app.get('/api/refresh', async (req, res) => {
    const keyword = req.query.keyword || 'cartrack';

    const [serpData, metrics] = await Promise.all([
        getSerpData(keyword),
        getVolumeAndCompetitors(keyword)
    ]);

    const record = {
        keyword: keyword.toLowerCase(),
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString('en-ZA'),
        time: new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }),
        googleRank: serpData.googleRank,
        bingRank: serpData.bingRank,
        volume: metrics.volume,
        difficulty: metrics.difficulty,
        aiSnippet: serpData.aiSnippet,
        citationConfidence: serpData.citationConfidence,
        competitors: metrics.competitors
    };

    const history = JSON.parse(fs.readFileSync(jsonPath, 'utf-8') || '[]');
    history.push(record);
    fs.writeFileSync(jsonPath, JSON.stringify(history, null, 2));

    res.json({ success: true, data: record });
});

app.get('/api/history', (req, res) => res.json(JSON.parse(fs.readFileSync(jsonPath, 'utf-8') || '[]')));

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));