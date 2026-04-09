import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { renderVideo } from './render';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use('/static', express.static(path.join(process.cwd(), 'temp')));

// Set up storage for uploaded files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'temp');
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

app.post('/api/render', upload.any(), async (req, res) => {
    try {
        const payloadStr = req.body.payload;
        if (!payloadStr) {
            return res.status(400).json({ error: 'Missing payload' });
        }

        const payload = JSON.parse(payloadStr);
        const files = req.files as Express.Multer.File[];

        // Map the uploaded file paths back to the payload
        const updatedScenes = payload.scenes.map((scene: any) => {
            const imgFile = files.find(f => f.fieldname === scene.imageKey);
            const audioFile = files.find(f => f.fieldname === scene.audioKey);
            const videoFile = scene.videoKey ? files.find(f => f.fieldname === scene.videoKey) : null;
            const musicFile = scene.musicKey ? files.find(f => f.fieldname === scene.musicKey) : null;
            const sfxFile = scene.sfxKey ? files.find(f => f.fieldname === scene.sfxKey) : null;

            // Map absolute paths to static HTTP URLs for the browser
            const host = `http://localhost:${port}`;
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

        console.log(`Starting render for ${finalPayload.scenes.length} scenes...`);

        const outputPath = await renderVideo(finalPayload);

        res.download(outputPath, 'final_video.mp4', (err) => {
            if (err) {
                console.error('Error sending file:', err);
            }
            // Cleanup temp files after sending
            // files.forEach(f => fs.unlinkSync(f.path));
            // fs.unlinkSync(outputPath);
        });

    } catch (error: any) {
        console.error('Render API Error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

app.listen(port, () => {
    console.log(`Remotion server listening at http://localhost:${port}`);
});
