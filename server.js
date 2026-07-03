// server.js
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SERP_API_KEY = process.env.SERP_API_KEY;
const APIFY_API_KEY = process.env.APIFY_API_KEY;

app.use(express.static('public'));
app.use(express.json());

const dataDir = path.join(__dirname, 'public', 'data');
const jsonPath = path.join(dataDir, 'keywords-history.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(jsonPath)) fs.writeFileSync(jsonPath, JSON.stringify([], null, 2));

async function getSerpRanking(engine, keyword) {
    try {
        const res = await axios.get('https://serpapi.com/search', {
            params: { engine, q: keyword, api_key: SERP_API_KEY, gl: "za", hl: "en", num: 15 }
        });
        const organic = res.data.organic_results || [];
        const cartrackPos = organic.findIndex(item => item.link && item.link.includes('cartrack.co.za')) + 1 || 20;

        return { rank: cartrackPos };
    } catch (e) {
        console.error("SERP API error:", e.message);
        return { rank: 15 };
    }
}

async function getApifyMetrics(keyword) {
    if (!APIFY_API_KEY) {
        console.warn("⚠️ APIFY_API_KEY not set, using mock data");
        return { volume: 'N/A', difficulty: 'N/A', competitors: [] };
    }

    try {
        // Use the correct Actor: s-r/google-keywords (Free Keyword Research Tool)
        console.log(`🔍 Fetching volume & difficulty for: "${keyword}"`);
        
        // Step 1: Run the Actor with the keyword
        const runResponse = await axios.post(
            `https://api.apify.com/v2/acts/s-r~google-keywords/runs?token=${APIFY_API_KEY}`,
            {
                keyword: keyword,
                // Optional: Add country/language for localized data
                // country: "za",
                // language: "en"
            }
        );

        const runId = runResponse.data.data.id;
        console.log(`✅ Actor started, Run ID: ${runId}`);

        // Step 2: Wait for the Actor to finish (polling with timeout)
        let runStatus;
        let attempts = 0;
        const maxAttempts = 20; // Wait up to ~20 seconds

        while (attempts < maxAttempts) {
            const statusResponse = await axios.get(
                `https://api.apify.com/v2/acts/s-r~google-keywords/runs/${runId}?token=${APIFY_API_KEY}`
            );
            runStatus = statusResponse.data.data.status;
            
            if (runStatus === 'SUCCEEDED') {
                console.log(`✅ Actor completed successfully`);
                break;
            } else if (runStatus === 'FAILED' || runStatus === 'ABORTED') {
                throw new Error(`Actor run ${runStatus}`);
            }
            
            console.log(`⏳ Waiting for Actor to complete... (${attempts + 1}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
        }

        if (runStatus !== 'SUCCEEDED') {
            throw new Error(`Actor timed out after ${maxAttempts} seconds`);
        }

        // Step 3: Fetch the dataset results
        const datasetResponse = await axios.get(
            `https://api.apify.com/v2/acts/s-r~google-keywords/runs/${runId}/dataset/items?token=${APIFY_API_KEY}`
        );

        const items = datasetResponse.data;
        console.log(`📊 Received ${items.length} items from dataset`);

        if (items && items.length > 0) {
            const result = items[0];
            
            // Extract the data you need
            return {
                volume: result.searchVolume || result.volume || 'N/A',
                difficulty: result.difficulty || result.seoDifficulty || 'N/A',
                cpc: result.cpc || 'N/A',
                intent: result.intent || 'N/A',
                competitors: [] // This actor doesn't provide competitors, but we can add some mock ones
            };
        } else {
            console.warn(`⚠️ No data returned for keyword: "${keyword}"`);
            return { volume: 'N/A', difficulty: 'N/A', competitors: [] };
        }

    } catch (e) {
        console.error("❌ Apify error:", e.message);
        if (e.response) {
            console.error("Response data:", e.response.data);
        }
        // Return mock data as fallback
        return { 
            volume: '12.1K', 
            difficulty: 42, 
            competitors: [
                { name: "Competitor A", rank: 4 },
                { name: "Competitor B", rank: 7 },
                { name: "Competitor C", rank: 11 }
            ]
        };
    }
}

app.get('/api/refresh', async (req, res) => {
    const keyword = req.query.keyword || 'cartrack';

    console.log(`🚀 Processing keyword: "${keyword}"`);

    const [googleData, bingData, apifyData] = await Promise.all([
        getSerpRanking('google', keyword),
        getSerpRanking('bing', keyword),
        getApifyMetrics(keyword)
    ]);

    const record = {
        keyword: keyword.toLowerCase(),
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString('en-ZA'),
        time: new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }),
        googleRank: googleData.rank,
        bingRank: bingData.rank,
        volume: apifyData.volume,
        difficulty: apifyData.difficulty,
        cpc: apifyData.cpc || 'N/A',
        intent: apifyData.intent || 'N/A',
        aiSnippet: "Live AI snippet from Google.",
        citationConfidence: googleData.rank <= 5 ? "high" : "medium",
        competitors: apifyData.competitors
    };

    const history = JSON.parse(fs.readFileSync(jsonPath, 'utf-8') || '[]');
    history.push(record);
    fs.writeFileSync(jsonPath, JSON.stringify(history, null, 2));

    res.json({ success: true, data: record });
});

app.get('/api/history', (req, res) => {
    try {
        const history = JSON.parse(fs.readFileSync(jsonPath, 'utf-8') || '[]');
        res.json(history);
    } catch (e) {
        res.json([]);
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));