// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.static('public'));
app.use(express.json());

const dataDir = path.join(__dirname, 'public', 'data');
const jsonPath = path.join(dataDir, 'keywords-history.json');

// Ensure directory and file exist on startup
function initializeStorage() {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log('✅ Created data directory');
    }
    
    if (!fs.existsSync(jsonPath)) {
        fs.writeFileSync(jsonPath, JSON.stringify([], null, 2));
        console.log('✅ Created keywords-history.json with empty array');
    } else {
        console.log('✅ Found existing keywords-history.json');
    }
}

initializeStorage();

function getHistory() {
    try {
        const data = fs.readFileSync(jsonPath, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Error reading history:', e);
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
        month: new Date().toLocaleString('en-ZA', { month: 'long', year: 'numeric' }),
        rank: searchData.rank || 1,
        volume: searchData.volume || '12.5K',
        difficulty: searchData.difficulty || 35,
        zaRank: searchData.zaRank || 1,
        topPage: 'cartrack.co.za',
        aiStatus: searchData.aiStatus || 'included',
        aiSnippet: searchData.aiSnippet || 'Cartrack offers real-time fleet tracking solutions...',
        aiPlatforms: '5',
        aiContext: 'Strong AI visibility'
    };

    history.push(record);
    fs.writeFileSync(jsonPath, JSON.stringify(history, null, 2));
    console.log(`✅ Saved record for "${keyword}" at ${record.time}`);
    return record;
}

// Refresh endpoint
app.get('/api/refresh', async (req, res) => {
    const keyword = (req.query.keyword || 'cartrack').toLowerCase();
    
    const searchData = {
        rank: Math.floor(Math.random() * 8) + 1,
        volume: (Math.random() * 40 + 5).toFixed(1) + 'K',
        difficulty: Math.floor(Math.random() * 70),
        aiStatus: 'included'
    };

    const record = saveRecord(keyword, searchData);
    res.json({ success: true, data: record });
});

// Get full history
app.get('/api/history', (req, res) => {
    res.json(getHistory());
});

// Get latest for a keyword
app.get('/api/latest', (req, res) => {
    const keyword = (req.query.keyword || 'cartrack').toLowerCase();
    const history = getHistory();
    const latest = history
        .filter(r => r.keyword === keyword)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    res.json(latest || null);
});

app.listen(PORT, () => {
    console.log(`\n🚀 Server running at http://localhost:${PORT}`);
    console.log(`📁 JSON file: ${jsonPath}\n`);
});