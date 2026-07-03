// server.js
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const APIFY_API_KEY = process.env.APIFY_API_KEY;   // Add this in Railway Variables

app.use(express.static('public'));
app.use(express.json());

const dataDir = path.join(__dirname, 'public', 'data');
const jsonPath = path.join(dataDir, 'keywords-history.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(jsonPath)) fs.writeFileSync(jsonPath, JSON.stringify([], null, 2));

async function getLiveData(keyword) {
    try {
        const response = await axios.post(`https://api.apify.com/v2/acts/apify~google-search-scraper/runs?token=${APIFY_API_KEY}`, {
            queries: [keyword],
            countryCode: "za",
            languageCode: "en",
            maxPagesPerQuery: 1
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        const runId = response.data.data.id;
        // Wait a bit for run to complete (simple version)
        await new Promise(resolve => setTimeout(resolve, 8000));

        const resultsRes = await axios.get(`https://api.apify.com/v2/acts/apify~google-search-scraper/runs/${runId}/dataset/items?token=${APIFY_API_KEY}`);
        const items = resultsRes.data;

        const organic = items[0]?.organicResults || [];

        const cartrackPos = organic.findIndex(item => item.url && item.url.includes('cartrack.co.za')) + 1;

        // Competitor detection
        const competitors = ['tracker', 'mix', 'netstar', 'ctrack', 'fleet', 'telematics'];
        let competitorData = competitors.map(comp => {
            const pos = organic.findIndex(item => item.title && item.title.toLowerCase().includes(comp));
            return { name: comp.charAt(0).toUpperCase() + comp.slice(1), rank: pos + 1 || 'N/A' };
        });

        return {
            googleRank: cartrackPos || 20,
            volume: items[0]?.searchVolume ? items[0].searchVolume.toLocaleString() : 'N/A',
            difficulty: items[0]?.keywordDifficulty || 'N/A',
            aiSnippet: "Live AI snippet not available in this scraper.",
            citationConfidence: cartrackPos <= 5 ? "high" : "medium",
            competitors: competitorData
        };
    } catch (error) {
        console.error("Apify error:", error.message);
        return {
            googleRank: 15,
            volume: 'N/A',
            difficulty: 'N/A',
            aiSnippet: "Error fetching live data.",
            citationConfidence: "low",
            competitors: []
        };
    }
}

app.get('/api/refresh', async (req, res) => {
    const keyword = req.query.keyword || 'cartrack';
    const data = await getLiveData(keyword);

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