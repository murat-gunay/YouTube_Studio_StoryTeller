import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load env from the root .env.local file
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3001/api/youtube/callback';

const TOKENS_PATH = path.join(__dirname, 'temp', 'youtube-tokens.json');

function readAllTokens() {
    if (!fs.existsSync(TOKENS_PATH)) return {};
    try {
        const data = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8'));
        // Migrate old format
        if (data.access_token) {
            return { 'default': data };
        }
        return data;
    } catch (e) {
        return {};
    }
}

/**
 * Instantiates the Google OAuth2 client with your client credentials.
 */
export function getOAuthClient() {
    if (!CLIENT_ID || !CLIENT_SECRET) {
        console.error("❌ [YouTubeService] Credentials missing in environment variables:", {
            CLIENT_ID: !!CLIENT_ID,
            CLIENT_SECRET: !!CLIENT_SECRET
        });
        throw new Error("Missing YouTube OAuth credentials. Please check your .env.local file.");
    }
    return new google.auth.OAuth2(
        CLIENT_ID,
        CLIENT_SECRET,
        REDIRECT_URI
    );
}

/**
 * Generates the Google consent screen link.
 */
export function getAuthUrl(lang: string = 'default'): string {
    const oauth2Client = getOAuthClient();
    return oauth2Client.generateAuthUrl({
        access_type: 'offline', // Crucial to get a refresh token!
        prompt: 'consent', // Force consent screen to guarantee we get a refresh token
        state: lang, // Pass language mapping
        scope: [
            'https://www.googleapis.com/auth/youtube.upload',
            'https://www.googleapis.com/auth/youtube.readonly'
        ]
    });
}

/**
 * Exchanges the auth code for access & refresh tokens and stores them on disk.
 */
export async function saveTokens(code: string, lang: string = 'default'): Promise<any> {
    console.info(`🔒 [YouTubeService] Exchanging auth code for tokens (${lang})...`);
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    
    let allTokens = readAllTokens();
    let oldTokens = allTokens[lang] || {};
    let finalTokens = { ...tokens };

    // Prevent overwriting a previously saved refresh token with an empty one
    if (!finalTokens.refresh_token && oldTokens.refresh_token) {
        finalTokens.refresh_token = oldTokens.refresh_token;
    }

    allTokens[lang] = finalTokens;

    const tempDir = path.dirname(TOKENS_PATH);
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    fs.writeFileSync(TOKENS_PATH, JSON.stringify(allTokens, null, 2), 'utf-8');
    console.info(`🔒 [YouTubeService] OAuth tokens saved successfully for ${lang}.`);
    return finalTokens;
}

/**
 * Retrieves an authenticated YouTube API client, refreshing tokens if necessary.
 */
export async function getYouTubeClient(lang: string = 'default') {
    const oauth2Client = getOAuthClient();
    const allTokens = readAllTokens();
    const tokens = allTokens[lang];
    
    if (!tokens) {
        throw new Error(`No YouTube channel connected for ${lang}. Please authenticate first.`);
    }
    
    oauth2Client.setCredentials(tokens);

    // Save tokens if they get auto-refreshed
    oauth2Client.on('tokens', (newTokens) => {
        try {
            console.info(`🔒 [YouTubeService] Access token refreshed automatically for ${lang}.`);
            const currentTokens = readAllTokens();
            const merged = { ...(currentTokens[lang] || {}), ...newTokens };
            currentTokens[lang] = merged;
            fs.writeFileSync(TOKENS_PATH, JSON.stringify(currentTokens, null, 2), 'utf-8');
        } catch (e) {
            console.error(`🔒 [YouTubeService] Failed to save refreshed tokens for ${lang}:`, e);
        }
    });

    return google.youtube({
        version: 'v3',
        auth: oauth2Client
    });
}

/**
 * Checks if the server is authenticated to YouTube.
 */
export function isConnected(lang: string = 'default'): boolean {
    const allTokens = readAllTokens();
    return !!allTokens[lang];
}

/**
 * Fetches the authenticated channel's profile (name, handle, avatar).
 */
export async function getChannelDetails(lang: string = 'default') {
    try {
        const youtube = await getYouTubeClient(lang);
        const response = await youtube.channels.list({
            part: ['snippet', 'statistics'],
            mine: true
        });

        if (!response.data.items || response.data.items.length === 0) {
            throw new Error(`No channel found for the authenticated user for ${lang}.`);
        }

        const channel = response.data.items[0];
        const snippet = channel.snippet || {};
        return {
            id: channel.id,
            title: snippet.title || "Unknown Channel",
            customUrl: snippet.customUrl || "", // e.g. @TipsForMinds
            avatar: snippet.thumbnails?.default?.url || ""
        };
    } catch (error: any) {
        if (error.message && error.message.includes('invalid_grant')) {
            console.warn(`🔒 [YouTubeService] invalid_grant detected in getChannelDetails for ${lang}. Deleting invalid tokens.`);
            disconnectYouTube(lang);
        }
        throw error;
    }
}

/**
 * Disconnects the channel by deleting the tokens.
 */
export function disconnectYouTube(lang: string = 'default') {
    let allTokens = readAllTokens();
    if (allTokens[lang]) {
        delete allTokens[lang];
        fs.writeFileSync(TOKENS_PATH, JSON.stringify(allTokens, null, 2), 'utf-8');
        console.info(`🔒 [YouTubeService] OAuth tokens deleted successfully for ${lang}.`);
        return true;
    }
    return false;
}

const languageToIsoCode: Record<string, string> = {
    'English': 'en',
    'Spanish': 'es',
    'French': 'fr',
    'German': 'de',
    'Chinese': 'zh',
    'Japanese': 'ja',
    'Turkish': 'tr',
    'Portuguese': 'pt-BR',
    'Hindi': 'hi',
    'Arabic': 'ar',
    'default': 'en'
};

/**
 * Stream/upload a video to YouTube (Private) and attach its thumbnail if available.
 */
export async function uploadVideo({
    filePath,
    title,
    description,
    tags,
    thumbnailPath,
    lang = 'default',
    category,
    onProgress
}: {
    filePath: string;
    title: string;
    description: string;
    tags?: string[];
    thumbnailPath?: string;
    lang?: string;
    category?: string;
    onProgress?: (progress: number) => void;
}) {
    console.info(`🎬 [YouTubeService] Starting video upload to YouTube (${lang})...`);
    console.info(`   - File: ${filePath}`);
    console.info(`   - Title: ${title}`);
    console.info(`   - Description Length: ${description.length} chars`);

    if (!fs.existsSync(filePath)) {
        throw new Error(`Rendered video file not found at ${filePath}`);
    }

    try {
        const youtube = await getYouTubeClient(lang);
        const isoCode = languageToIsoCode[lang] || 'en';

        // 1. Upload Video
        const videoResponse = await youtube.videos.insert({
            part: ['snippet', 'status'],
            requestBody: {
                snippet: {
                    title: title.substring(0, 100), // YouTube title limit is 100
                    description: description,
                    categoryId: category || "22", // People & Blogs or custom category ID
                    tags: tags || [],
                    defaultAudioLanguage: isoCode,
                    defaultLanguage: isoCode
                },
                status: {
                    privacyStatus: 'private', // Forced to Private as requested
                    selfDeclaredMadeForKids: false
                }
            },
            media: {
                body: fs.createReadStream(filePath)
            }
        }, {
            onUploadProgress: (evt) => {
                const size = fs.statSync(filePath).size;
                const progress = size > 0 ? Math.round((evt.bytesRead / size) * 100) : 0;
                console.info(`   - Video Uploading... ${progress}% (${evt.bytesRead}/${size} bytes)`);
                if (onProgress) {
                    onProgress(progress);
                }
            }
        });

        const videoId = videoResponse.data.id;
        if (!videoId) {
            throw new Error("YouTube upload succeeded but no video ID was returned.");
        }

        console.info(`🎬 [YouTubeService] Video uploaded successfully! ID: ${videoId}`);

        // 2. Upload Thumbnail if available
        if (thumbnailPath && fs.existsSync(thumbnailPath)) {
            console.info(`🎬 [YouTubeService] Uploading thumbnail from ${thumbnailPath}...`);
            try {
                await youtube.thumbnails.set({
                    videoId: videoId,
                    media: {
                        body: fs.createReadStream(thumbnailPath)
                    }
                });
                console.info(`🎬 [YouTubeService] Thumbnail uploaded successfully!`);
            } catch (e: any) {
                console.error(`❌ [YouTubeService] Failed to set thumbnail for video ${videoId}:`, e.message || e);
                // Non-blocking error: the video is uploaded successfully even if thumbnail fails
            }
        }

        return {
            videoId,
            videoUrl: `https://www.youtube.com/watch?v=${videoId}`
        };
    } catch (error: any) {
        if (error.message && error.message.includes('invalid_grant')) {
            console.warn(`🔒 [YouTubeService] invalid_grant detected in uploadVideo for ${lang}. Deleting invalid tokens.`);
            disconnectYouTube(lang);
        }
        throw error;
    }
}
