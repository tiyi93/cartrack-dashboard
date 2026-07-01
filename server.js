// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

const dataDir = path.join(__dirname, 'public', 'data');
const jsonPath = path.join(dataDir, 'keywords-history.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(jsonPath)) fs.writeFileSync(jsonPath, JSON.stringify([], null, 2));

function getHistory() {
    try {
        return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    } catch (e) {
        return [];
    }
}

function saveRecord(keyword, searchData) {
    const history = getHistory();
    const record = {
        keyword: keyword.toLowerCase(),
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString('en-ZA'),
        time: new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }),
        rank: searchData.rank || Math.floor(Math.random() * 8) + 1,
        volume: searchData.volume || (Math.random() * 40 + 8).toFixed(1) + 'K',
        difficulty: searchData.difficulty || Math.floor(Math.random() * 70),
        zaRank: searchData.rank || 1,
        topPage: 'cartrack.co.za',
        aiStatus: searchData.aiStatus || 'included',
        aiSnippet: searchData.aiSnippet || 'Cartrack offers real-time fleet tracking and vehicle recovery solutions in South Africa.'
    };

    history.push(record);
    fs.writeFileSync(jsonPath, JSON.stringify(history, null, 2));
    return record;
}

// IMPORTANT: This now ALWAYS returns fresh data on /api/refresh
app.get('/api/refresh', async (req, res) => {
    const keyword = (req.query.keyword || 'cartrack').toLowerCase();
    
    // Simulate fresh search (replace later with SerpAPI)
    const freshData = {
        rank: Math.floor(Math.random() * 8) + 1,
        volume: (Math.random() * 45 + 7).toFixed(1) + 'K',
        difficulty: Math.floor(Math.random() * 75),
        aiStatus: 'included',
        aiSnippet: `Fresh data for "${keyword}" - Real-time fleet management and tracking solutions.`
    };

    const record = saveRecord(keyword, freshData);
    res.json({ success: true, data: record });
});

app.get('/api/history', (req, res) => res.json(getHistory()));

app.get('/api/latest', (req, res) => {
    const keyword = (req.query.keyword || 'cartrack').toLowerCase();
    const history = getHistory();
    const latest = history
        .filter(r => r.keyword === keyword)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    res.json(latest || null);
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});