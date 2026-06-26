const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    
    // Serve index.html for root path
    if (parsedUrl.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
        return;
    }

    if (parsedUrl.pathname === '/api/import') {
        // Set headers for Server-Sent Events (Live Streaming)
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders && res.flushHeaders();

        const designNo = parsedUrl.query.designno || req.body?.designnos || req.body?.designno;
        
        console.log(`[SERVER] 🚀 Spawning background process for: ${designNo}.`);

        
        if (!designNo) {
            res.write(`data: ❌ ERROR: Design number required.\n\n`);
            res.write(`data: [DONE]\n\n`);
            res.end();
            return;
        }

        // Spawn the pure CLI script as a child process
        const child = spawn('node', ['import.js', designNo]);

        // Capture standard output and send it as SSE data
        child.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            for (const line of lines) {
                if (line) res.write(`data: ${line}\n\n`);
            }
        });

        // Capture standard error and send it as SSE data
        child.stderr.on('data', (data) => {
            const lines = data.toString().split('\n');
            for (const line of lines) {
                if (line) res.write(`data: ❌ ERROR: ${line}\n\n`);
            }
        });

        // When the background script completely finishes
        child.on('close', (code) => {
            res.write(`data: \n[SERVER] Background process exited with code ${code}\n\n`);
            res.write(`data: [DONE]\n\n`);
            res.end();
        });

        return;
    }

    // 404 for anything else
    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`\n✅ Standalone Web Server running!`);
    console.log(`👉 Open http://localhost:${PORT} in your browser to start importing.`);
    console.log(`(Press Ctrl+C to stop)`);
});
