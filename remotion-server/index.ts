import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { renderVideo } from './render';

// Load environment variables from parent directory's .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import {
    getAuthUrl,
    saveTokens,
    isConnected,
    getChannelDetails,
    disconnectYouTube,
    uploadVideo
} from './youtubeService';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use('/static', express.static('/Volumes/Yeni Birim/YouTubeStudio/Football_Simulator'));
 
// Set up storage for uploaded files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = '/Volumes/Yeni Birim/YouTubeStudio/Football_Simulator';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
 
const upload = multer({ storage });

// Health check / Interface for browser
app.get('/', (req, res) => {
    res.send(`
        <div style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: #f8fafc;">
            <div style="font-size: 3rem;">🎬</div>
            <h1 style="color: #6366f1;">Remotion Render Server</h1>
            <p style="color: #94a3b8;">Status: <span style="color: #22c55e; font-weight: bold;">ONLINE</span></p>
            <p style="font-size: 0.8rem; color: #475569;">Listening for POST requests at /api/render</p>
        </div>
    `);
});

interface RenderJob {
    id: string;
    status: 'rendering' | 'completed' | 'failed';
    outputPath?: string;
    error?: string;
}

const renderJobs = new Map<string, RenderJob>();

app.post('/api/render', upload.any(), async (req, res) => {
    console.info(`\n📥 [Server:API] === Received Render Request ===`);
    console.info(`📥 [Server:API] Headers:`, JSON.stringify(req.headers));
    
    try {
        const payloadStr = req.body.payload;
        if (!payloadStr) {
            console.error(`❌ [Server:API] Missing 'payload' field in body!`);
            return res.status(400).json({ error: 'Missing payload' });
        }

        console.info(`📥 [Server:API] Parsing payload JSON...`);
        const payload = JSON.parse(payloadStr);
        const files = req.files as Express.Multer.File[];
        
        console.info(`📥 [Server:API] Payload details:
  - isAnimatedMode: ${payload.isAnimatedMode}
  - fps: ${payload.fps}
  - resolution: ${JSON.stringify(payload.resolution)}
  - scenes count: ${payload.scenes?.length}
  - transitionFrames: ${payload.transitionFrames}`);

        console.info(`📥 [Server:API] Uploaded files (${files?.length || 0} total):`);
        if (files) {
            files.forEach((f, idx) => {
                console.info(`  [File ${idx}] fieldname="${f.fieldname}" originalname="${f.originalname}" size=${f.size} path="${f.path}"`);
            });
        }

        // Map the uploaded file paths back to the payload
        console.info(`📥 [Server:API] Mapping uploaded files to scene paths...`);
        const updatedScenes = payload.scenes.map((scene: any, idx: number) => {
            const imgFile = files.find(f => f.fieldname === scene.imageKey);
            const audioFile = files.find(f => f.fieldname === scene.audioKey);
            const videoFile = scene.videoKey ? files.find(f => f.fieldname === scene.videoKey) : null;
            const musicFile = scene.musicKey ? files.find(f => f.fieldname === scene.musicKey) : null;
            const sfxFile = scene.sfxKey ? files.find(f => f.fieldname === scene.sfxKey) : null;

            // Map absolute paths to static HTTP URLs for the browser
            const host = `http://localhost:${port}`;
            
            console.info(`  [Scene ${idx} (id=${scene.id})]
    - imageKey="${scene.imageKey}" -> imgFile=${imgFile ? imgFile.originalname : 'MISSING'}
    - audioKey="${scene.audioKey}" -> audioFile=${audioFile ? audioFile.originalname : 'MISSING'}
    - videoKey="${scene.videoKey}" -> videoFile=${videoFile ? videoFile.originalname : 'NOT APPLICABLE/MISSING'}
    - musicKey="${scene.musicKey}" -> musicFile=${musicFile ? musicFile.originalname : 'NOT APPLICABLE/MISSING'}
    - sfxKey="${scene.sfxKey}" -> sfxFile=${sfxFile ? sfxFile.originalname : 'NOT APPLICABLE/MISSING'}`);

            return {
                ...scene,
                imagePath: imgFile ? `${host}/static/${path.basename(imgFile.path)}` : null,
                audioPath: audioFile ? `${host}/static/${path.basename(audioFile.path)}` : null,
                videoPath: videoFile ? `${host}/static/${path.basename(videoFile.path)}` : null,
                musicPath: musicFile ? `${host}/static/${path.basename(musicFile.path)}` : null,
                sfxPath: sfxFile ? `${host}/static/${path.basename(sfxFile.path)}` : null,
            };
        });

        const finalPayload = {
            ...payload,
            scenes: updatedScenes,
        };

        const jobId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        console.info(`📥 [Server:API] Registered job ${jobId}. Starting render in background...`);
        
        renderJobs.set(jobId, {
            id: jobId,
            status: 'rendering'
        });

        // Trigger rendering asynchronously in the background
        renderVideo(finalPayload).then((outputPath) => {
            console.info(`📥 [Server:API] [Job ${jobId}] Render completed successfully. Output: ${outputPath}`);
            renderJobs.set(jobId, {
                id: jobId,
                status: 'completed',
                outputPath
            });
        }).catch((err) => {
            console.error(`❌ [Server:API] [Job ${jobId}] Render failed:`, err);
            renderJobs.set(jobId, {
                id: jobId,
                status: 'failed',
                error: err.message || 'Rendering failed'
            });
        });

        // Return the jobId immediately
        res.json({
            success: true,
            jobId
        });

    } catch (error: any) {
        console.error('❌ [Server:API] Render API Error:', error);
        console.error(error.stack || error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

// GET job status polling route
app.get('/api/render/status/:jobId', (req, res) => {
    const { jobId } = req.params;
    const job = renderJobs.get(jobId);
    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status === 'completed') {
        res.json({
            status: 'completed',
            filename: job.outputPath ? path.basename(job.outputPath) : null
        });
    } else if (job.status === 'failed') {
        res.json({
            status: 'failed',
            error: job.error
        });
    } else {
        res.json({
            status: 'rendering'
        });
    }
});


// --- YouTube Integration Routes ---

// 1. Get Google OAuth consent URL
app.get('/api/youtube/auth-url', (req, res) => {
    try {
        const lang = (req.query.lang as string) || 'default';
        const url = getAuthUrl(lang);
        res.json({ url });
    } catch (error: any) {
        console.error("❌ [Server:YouTube] Auth URL Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 2. Google OAuth callback redirect handler
app.get('/api/youtube/callback', async (req, res) => {
    const code = req.query.code as string;
    const lang = (req.query.state as string) || 'default';
    if (!code) {
        return res.status(400).send("<h3>Authentication Failed</h3><p>Missing authorization code from Google.</p>");
    }
    try {
        await saveTokens(code, lang);
        res.send(`
            <html>
            <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: #f8fafc;">
                <div style="font-size: 3rem;">✅</div>
                <h1 style="color: #22c55e;">YouTube Connected Successfully!</h1>
                <p style="color: #94a3b8;">This window will close automatically in a moment.</p>
                <script>
                    try {
                        if (window.opener) {
                            window.opener.postMessage({ type: 'YOUTUBE_CONNECTED' }, '*');
                        }
                    } catch (e) {
                        console.error("Failed to notify opener:", e);
                    }
                    setTimeout(() => {
                        window.close();
                    }, 2000);
                </script>
            </body>
            </html>
        `);
    } catch (error: any) {
        console.error("❌ [Server:YouTube] Callback Error:", error.message);
        res.status(500).send(`<h3>Authentication Failed</h3><p>${error.message}</p>`);
    }
});

// 3. Get connected channel status
app.get('/api/youtube/status', async (req, res) => {
    try {
        const lang = (req.query.lang as string) || 'default';
        if (!isConnected(lang)) {
            return res.json({ isConnected: false });
        }
        const channel = await getChannelDetails(lang);
        res.json({ isConnected: true, channel });
    } catch (error: any) {
        console.error("❌ [Server:YouTube] Status Error:", error.message);
        res.json({ isConnected: false, error: error.message });
    }
});

// 4. Disconnect channel
app.post('/api/youtube/disconnect', (req, res) => {
    try {
        const lang = (req.query.lang as string) || 'default';
        const success = disconnectYouTube(lang);
        res.json({ success });
    } catch (error: any) {
        console.error("❌ [Server:YouTube] Disconnect Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

const cpUpload = upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'video', maxCount: 1 }
]);

// 5. Upload Video with Custom Thumbnail (or direct Video Upload for imported projects)
app.post('/api/youtube/upload', cpUpload, async (req, res) => {
    console.info(`\n📤 [Server:YouTube] === Received YouTube Upload Request ===`);
    let videoPathToDelete: string | undefined;
    try {
        const { videoFilename, title, description, tags: tagsStr, lang, category } = req.body;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        
        const thumbnailFile = files?.thumbnail?.[0];
        const videoFile = files?.video?.[0];

        let videoPath = "";
        if (videoFile) {
            videoPath = videoFile.path;
            videoPathToDelete = videoFile.path;
            console.info(`📤 [Server:YouTube] Received direct video upload: ${videoPath}`);
        } else {
            if (!videoFilename) {
                return res.status(400).json({ error: "Missing videoFilename or uploaded video file." });
            }
            videoPath = path.join('/Volumes/Yeni Birim/YouTubeStudio/Football_Simulator', videoFilename);
            if (!fs.existsSync(videoPath)) {
                return res.status(404).json({ error: `Video file ${videoFilename} not found on server.` });
            }
        }

        let tags: string[] = [];
        if (tagsStr) {
            try {
                tags = JSON.parse(tagsStr);
            } catch (_) {
                if (typeof tagsStr === 'string') {
                    tags = tagsStr.split(',').map(t => t.trim());
                }
            }
        }

        let thumbnailPath: string | undefined;
        if (thumbnailFile) {
            thumbnailPath = thumbnailFile.path;
            console.info(`📤 [Server:YouTube] Received thumbnail upload: ${thumbnailPath}`);
        }

        console.info(`📤 [Server:YouTube] Triggering upload to YouTube (Private)...`);
        const result = await uploadVideo({
            filePath: videoPath,
            title: title || "AI Story Video",
            description: description || "",
            tags,
            thumbnailPath,
            lang: lang || 'default',
            category
        });

        // Clean up uploaded temporary files
        if (thumbnailPath && fs.existsSync(thumbnailPath)) {
            try {
                fs.unlinkSync(thumbnailPath);
            } catch (err) {
                console.warn("📤 [Server:YouTube] Failed to delete temporary thumbnail file:", err);
            }
        }

        if (videoPathToDelete && fs.existsSync(videoPathToDelete)) {
            try {
                fs.unlinkSync(videoPathToDelete);
            } catch (err) {
                console.warn("📤 [Server:YouTube] Failed to delete temporary video file:", err);
            }
        }

        res.json({
            success: true,
            videoId: result.videoId,
            videoUrl: result.videoUrl
        });

    } catch (error: any) {
        console.error('❌ [Server:YouTube] Upload Endpoint Error:', error);
        if (videoPathToDelete && fs.existsSync(videoPathToDelete)) {
            try {
                fs.unlinkSync(videoPathToDelete);
            } catch (_) {}
        }
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

// 6. Save Export ZIP to external volume
app.post('/api/project/save-zip', upload.single('zip'), (req, res) => {
    console.info(`\n📥 [Server] === Received Project ZIP Save Request ===`);
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: "Missing ZIP file payload." });
        }
        const exportDir = '/Volumes/Yeni Birim/YouTubeStudio/Football_Simulator';
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }
        const targetPath = path.join(exportDir, file.originalname);
        fs.renameSync(file.path, targetPath);
        console.info(`📦 [Server] Saved export ZIP to: ${targetPath}`);
        res.json({ success: true, path: targetPath });
    } catch (err: any) {
        console.error("❌ [Server] Failed to save project ZIP:", err);
        res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
});

// 7. List fixture files from workspace root
app.get('/api/fixtures', (req, res) => {
    try {
        const workspaceDir = path.join(__dirname, '..');
        const files = fs.readdirSync(workspaceDir);
        const fixtures = files
            .filter(file => (file.endsWith('.txt') || file.endsWith('.md')) && file !== 'README.md' && file !== 'package.json')
            .map(file => {
                const filePath = path.join(workspaceDir, file);
                const content = fs.readFileSync(filePath, 'utf8');
                return {
                    name: file.replace(/\.[^/.]+$/, ""),
                    filename: file,
                    content
                };
            });
        res.json({ success: true, fixtures });
    } catch (err: any) {
        console.error("❌ [Server] Failed to list fixtures:", err);
        res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
});

// 8. Save or update fixture file in workspace root
app.post('/api/fixtures/save', (req, res) => {
    try {
        const { name, content } = req.body;
        if (!name || content === undefined) {
            return res.status(400).json({ error: "Missing name or content." });
        }
        const filename = name.endsWith('.txt') || name.endsWith('.md') ? name : `${name}.txt`;
        const workspaceDir = path.join(__dirname, '..');
        const targetPath = path.join(workspaceDir, filename);
        
        fs.writeFileSync(targetPath, content, 'utf8');
        console.info(`💾 [Server] Saved fixture file: ${targetPath}`);
        res.json({ success: true, path: targetPath });
    } catch (err: any) {
        console.error("❌ [Server] Failed to save fixture file:", err);
        res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
});

// 9. List cached team profiles
app.get('/api/teams', (req, res) => {
    try {
        const teamsDir = path.join(__dirname, '..', 'teams');
        if (!fs.existsSync(teamsDir)) {
            return res.json([]);
        }
        const files = fs.readdirSync(teamsDir);
        const teams = files
            .filter(file => file.endsWith('.json'))
            .map(file => {
                const filePath = path.join(teamsDir, file);
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const parsed = JSON.parse(content);
                    return {
                        filename: file,
                        team_name: parsed.team_name || file.replace('.json', '')
                    };
                } catch (e) {
                    return null;
                }
            })
            .filter(Boolean);
        res.json(teams);
    } catch (err: any) {
        console.error("❌ [Server] Failed to list teams:", err);
        res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
});

// 10. Get team profile from cache
app.get('/api/teams/:name', (req, res) => {
    try {
        const teamName = req.params.name;
        if (!teamName) {
            return res.status(400).json({ error: "Missing team name." });
        }
        const fileName = teamName.toLowerCase().replace(/[^a-z0-9_-]/g, '') + '.json';
        const teamsDir = path.join(__dirname, '..', 'teams');
        const filePath = path.join(teamsDir, fileName);

        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            console.info(`💾 [Server] Loaded team cache for: ${teamName}`);
            return res.json(JSON.parse(content));
        } else {
            return res.status(404).json({ error: "Team cache not found." });
        }
    } catch (err: any) {
        console.error("❌ [Server] Failed to get team cache:", err);
        res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
});

// 11. Save or update team profile in cache
app.post('/api/teams/:name', (req, res) => {
    try {
        const teamName = req.params.name;
        const data = req.body;
        if (!teamName || !data) {
            return res.status(400).json({ error: "Missing team name or body." });
        }
        const fileName = teamName.toLowerCase().replace(/[^a-z0-9_-]/g, '') + '.json';
        const teamsDir = path.join(__dirname, '..', 'teams');
        
        if (!fs.existsSync(teamsDir)) {
            fs.mkdirSync(teamsDir, { recursive: true });
        }
        
        const filePath = path.join(teamsDir, fileName);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        console.info(`💾 [Server] Saved team cache for: ${teamName}`);
        res.json({ success: true, path: filePath });
    } catch (err: any) {
        console.error("❌ [Server] Failed to save team cache:", err);
        res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
});


// Custom error handling middleware to ensure we always return JSON
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('❌ [Server:Error] Uncaught error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    });
});

const server = app.listen(port, () => {
    console.log(`Remotion server listening at http://localhost:${port}`);
});
server.timeout = 1800000; // 30 minutes
server.keepAliveTimeout = 1800000;
server.headersTimeout = 1805000;

