const http = require('http');
const handler = require('./api/import.js');
const url = require('url');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config();

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    
    // Serve index.html for root path
    if (parsedUrl.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
        return;
    }

    // Mock Vercel environment for the API route
    if (parsedUrl.pathname === '/api/import') {
        const reqMock = {
            query: parsedUrl.query,
            body: {}
        };

        // Augment the real res object to act like Vercel's response
        res.status = function(code) {
            this.statusCode = code;
            return this;
        };
        res.json = function(data) {
            this.writeHead(this.statusCode || 200, { 'Content-Type': 'application/json' });
            this.end(JSON.stringify(data));
        };

        try {
            await handler(reqMock, res);
        } catch (error) {
            console.error('Local Server Error:', error);
            res.status(500).json({ error: error.message });
        }
        return;
    }

    // 404 for anything else
    res.writeHead(404);
    res.end('Not Found');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n✅ Local Server running!`);
    console.log(`👉 Open http://localhost:${PORT} in your browser to test locally.`);
    console.log(`(Press Ctrl+C to stop)`);
});
