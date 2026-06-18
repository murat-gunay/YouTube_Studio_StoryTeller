const http = require('http');
const { execSync } = require('child_process');

async function getJobs() {
    try {
        console.log("Enabling debugger on PID 71107...");
        execSync("kill -USR1 71107");
        console.log("Waiting 2 seconds for debugger to start...");
        await new Promise(r => setTimeout(r, 2000));

        // Get debugger WebSocket URL
        console.log("Fetching debugger metadata from http://127.0.0.1:9229/json ...");
        const metadata = await new Promise((resolve, reject) => {
            http.get('http://127.0.0.1:9229/json', (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(JSON.parse(data)));
            }).on('error', reject);
        });

        console.log("Debugger metadata:", JSON.stringify(metadata, null, 2));
        const target = metadata.find(t => t.type === 'node' || t.url.includes('index.ts'));
        if (!target) {
            throw new Error("No suitable debugger target found");
        }

        const wsUrl = target.webSocketDebuggerUrl;
        console.log("Connecting to WebSocket:", wsUrl);

        // We use a simple WebSocket connection to evaluate expression in Node context
        const WebSocket = require('ws');
        const ws = new WebSocket(wsUrl);

        ws.on('open', () => {
            console.log("WebSocket connected. Evaluating expression...");
            
            // Expression to find the local map in index.ts module
            const expression = `
                (() => {
                    // Try to find renderJobs from global or via module cache
                    let jobs = null;
                    try {
                        const path = require('path');
                        const indexModulePath = path.resolve('index.ts');
                        const mod = require.cache[indexModulePath] || require.cache[indexModulePath.replace('.ts', '.js')];
                        if (mod && mod.exports) {
                            // If exported
                        }
                    } catch(e) {}
                    
                    // Fallback: search require.cache
                    for (const key in require.cache) {
                        const m = require.cache[key];
                        if (m && m.exports && m.exports.renderJobs) {
                            jobs = m.exports.renderJobs;
                            break;
                        }
                        // Check if it's module scoped and we can inspect local variables
                    }
                    
                    // Since it's module-scoped in index.ts, let's see if we can query the express app's middleware/routes
                    // app is listening on port 3001, so we can find the app and check if we can inspect its router or routes
                    return "Evaluating...";
                })()
            `;

            // Wait, we can evaluate a simple command to check process variables or require cache
            ws.send(JSON.stringify({
                id: 1,
                method: 'Runtime.evaluate',
                params: {
                    expression: `
                        (() => {
                            // Find the index.ts module scope by evaluating a query on require.cache
                            const keys = Object.keys(require.cache);
                            const indexKey = keys.find(k => k.includes('remotion-server/index.ts') || k.includes('remotion-server/index.js'));
                            if (!indexKey) return { error: "index.ts not found in require.cache", keys };
                            
                            const indexModule = require.cache[indexKey];
                            
                            // Let's find any Map objects in the module scope
                            // Since they are not exported, we can look at the module's parent or children or inspect using V8 Debugger.
                            // However, we can also evaluate express routes to see if we can read them!
                            // Or let's see if we can find 'renderJobs' in the global scope if it was leaked, or if we can evaluate inside the module.
                            // Wait! We can just fetch the status of jobs by guessing jobIds if they are in the format: timestamp-random
                            // Or we can find the Map by checking all objects in memory!
                            return { keys: keys.filter(k => !k.includes('node_modules')) };
                        })()
                    `,
                    returnByValue: true
                }
            }));
        });

        ws.on('message', (data) => {
            console.log("WebSocket response:", data.toString());
            ws.close();
        });

        ws.on('error', (err) => {
            console.error("WebSocket error:", err);
        });

    } catch (e) {
        console.error("Error connecting to debugger:", e);
    }
}

getJobs();
