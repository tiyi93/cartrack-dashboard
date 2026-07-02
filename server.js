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

async function getSearchResults(engine, keyword) {
    try {
        const response = await axios.get('https://serpapi.com/search', {
            params: {
                engine: engine,
                q: keyword,
                api_key: SERP_API_KEY,
                gl: "za",
                hl: "en",
                num: 20  // Get more results to be sure
            }
        });

        const data = response.data;
        const organic = data.organic_results || [];

        // Find Cartrack positions
        let cartrackPositions = [];
        organic.forEach((result, index) => {
            if (result.link && result.link.includes('cartrack.co.za')) {
                cartrackPositions.push({
                    position: index + 1,
                    title: result.title,
                    link: result.link,
                    snippet: result.snippet
                });
            }
        });

        return {
            engine: engine,
            totalResults: organic.length,
            cartrackPositions: cartrackPositions,
            aiOverview: data.ai_overview ? data.ai_overview.text : null,
            raw: data  // for debugging
        };
    } catch (error) {
        console.error(`Error fetching ${engine}:`, error.message);
        return { engine, error: true, cartrackPositions: [] };
    }
}

app.get('/api/refresh', async (req, res) => {
    const keyword = req.query.keyword || 'cartrack';

    const [googleResult, bingResult] = await Promise.all([
        getSearchResults('google', keyword),
        getSearchResults('bing', keyword)
    ]);

    const record = {
        keyword: keyword.toLowerCase(),
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString('en-ZA'),
        time: new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }),
        google: googleResult,
        bing: bingResult,
        aiSnippet: googleResult.aiOverview || "No AI overview available.",
        citationConfidence: googleResult.cartrackPositions.length > 0 ? "high" : "low"
    };

    // Save to history
    const history = JSON.parse(fs.readFileSync(jsonPath, 'utf-8') || '[]');
    history.push(record);
    fs.writeFileSync(jsonPath, JSON.stringify(history, null, 2));

    res.json({ success: true, data: record });
});

app.get('/api/history', (req, res) => res.json(JSON.parse(fs.readFileSync(jsonPath, 'utf-8') || '[]')));

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});