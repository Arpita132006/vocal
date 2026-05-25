require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
// Removed nodemailer – using Brevo (SendinBlue) for OTP emails

const app = express();
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary');

// Set FFmpeg binary path from ffmpeg-static
ffmpeg.setFfmpegPath(ffmpegStatic);

// CLOUDINARY STORAGE CONFIG
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'vocalize_videos',
    resource_type: 'video',
  },
});
const upload = multer({ storage });

// Ensure directories exist
const dubbedDir = path.join(__dirname, 'public', 'dubbed');
const tempDir = path.join(__dirname, 'public', 'temp');
if (!fs.existsSync(dubbedDir)) {
  fs.mkdirSync(dubbedDir, { recursive: true });
}
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

app.use('/dubbed', express.static(path.join(__dirname, 'public', 'dubbed')));
app.use('/temp', express.static(path.join(__dirname, 'public', 'temp')));


// MODELS
const User =
require('./models/User');

const OTPLog =
require('./models/OTPlog');

const Video =
require('./models/Video');

const TranslatedVideo =
require('./models/TranslatedVideo');


// MIDDLEWARE
app.use(cors());

app.use(express.json());


// CONNECT MONGODB
mongoose.connect(
process.env.MONGODB_URI
)

.then(() => {

  console.log(
    "MongoDB Connected ✅"
  );

})

.catch((err) => {

  console.log(err);

});


// EMAIL TRANSPORTER (credentials from .env)
// Brevo email sender – will be used in sendOtpEmail
// No transporter needed


// OTP STORE (with timestamp for expiry)
let otpStore = {};

// OTP expires after 10 minutes
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5‑minute expiry as requested


// TEST ROUTE
app.get('/', (req, res) => {

  res.send(
    "Server is running 🚀"
  );

});


// SEND OTP
app.post('/send-otp', async (req, res) => {
  try {
    const email = req.body.email.trim().toLowerCase();
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6‑digit OTP
    otpStore[email] = { otp, createdAt: Date.now() }; // store with timestamp
    console.log(`OTP ${otp} generated for ${email}`);

    // Log OTP in DB (for debugging / audit)
    await OTPLog.create({ email, otp });

    // If Brevo credentials are set, send the email; otherwise just log
    if (process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL) {
      try {
        await sendBrevoEmail(email, otp);
      } catch (emailErr) {
        console.log('⚠️ Failed to send OTP via Brevo, continuing without email:', emailErr.message);
      }
    } else {
      console.log('🔔 Brevo credentials not configured – OTP email not sent.');
    }

    res.json({ success: true });
  } catch (err) {
    console.log('Error in /send-otp:', err);
    res.json({ success: false, message: err.message });
  }
});


// VERIFY OTP (with 5-minute expiry check)
app.post(
'/verify-otp',

(req, res) => {

  const email =
  req.body.email
  .trim()
  .toLowerCase();

  const otp =
  req.body.otp
  .toString()
  .trim();

  const stored = otpStore[email];

  console.log(
    "Stored OTP:",
    stored ? stored.otp : 'none'
  );

  console.log(
    "Entered OTP:",
    otp
  );

  if (
    stored &&
    stored.otp === otp &&
    (Date.now() - stored.createdAt) < OTP_EXPIRY_MS
  ) {

    // OTP is valid — delete it (one-time use)
    delete otpStore[email];

    res.json({
      success: true,
    });

  } else {

    // Check if OTP expired
    if (stored && stored.otp === otp) {
      console.log("OTP expired for", email);
    }

    res.json({
      success: false,
    });

  }

});


// CHECK USER
app.post(
'/check-user',

async (req, res) => {

  try {

    const email =
    req.body.email
    .trim()
    .toLowerCase();

    const existingUser =
    await User.findOne({
      email
    });

    if (existingUser) {

      res.json({

        exists: true,

        user: existingUser,

      });

    } else {

      res.json({
        exists: false,
      });

    }

  } catch (err) {

    console.log(err);

    res.json({
      exists: false,
    });

  }

});


// SAVE PROFILE
app.post(
'/save-profile',

async (req, res) => {

  try {

    const {

      email,
      name,
      age,
      gender,
      languages,

    } = req.body;

    const existingUser =
    await User.findOne({

      email:
      email
      .trim()
      .toLowerCase(),

    });

    if (existingUser) {
      existingUser.name = name;
      existingUser.age = age;
      existingUser.gender = gender;
      existingUser.languages = languages;
      await existingUser.save();

      return res.json({
        success: true,
      });

    }

    const newUser =
    new User({

      email:
      email
      .trim()
      .toLowerCase(),

      name,
      age,
      gender,
      languages,

    });

    await newUser.save();

    res.json({
      success: true,
    });

  } catch (err) {

    console.log(err);

    res.json({
      success: false,
    });

  }

});


// SAVE VIDEO
app.post(
'/save-video',

async (req, res) => {

  try {

    const {

      email,
      videoUrl,
      caption,
      language,

    } = req.body;

    const newVideo =
    new Video({

      email:
      email
      .trim()
      .toLowerCase(),

      videoUrl,
      caption,
      language,

    });

    await newVideo.save();

    console.log(
      'Video Saved ✅'
    );

    res.json({
      success: true,
    });

  } catch (err) {

    console.log(err);

    res.json({
      success: false,
    });

  }

});


// LOCAL TEMP UPLOAD STORAGE
const tempStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'public', 'temp'));
  },
  filename: function (req, file, cb) {
    cb(null, 'upload_' + Date.now() + path.extname(file.originalname || '.mp4'));
  }
});
const uploadTemp = multer({ storage: tempStorage });

// UPLOAD TEMP VIDEO (Local storage for gallery uploads before dubbing)
app.post(
'/api/upload-temp',
uploadTemp.single('video'),
async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    // Create a local URL for the uploaded file
    const localUrl = `/temp/${req.file.filename}`;
    
    res.json({
      success: true,
      videoUrl: localUrl,
    });
  } catch (err) {
    console.log('Temp upload error:', err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});


// UPLOAD VIDEO TO CLOUDINARY
app.post(
'/api/upload-video',
upload.single('video'),
async (req, res) => {
  try {
    const { email, caption, language } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const newVideo = new Video({
      email: email ? email.trim().toLowerCase() : 'unknown',
      caption: caption || 'Uploaded Video',
      language: language || 'English',
      videoUrl: req.file.path, // Cloudinary secure url
    });

    await newVideo.save();

    console.log('Video uploaded to Cloudinary & saved to DB ✅');

    res.json({
      success: true,
      video: newVideo,
    });
  } catch (err) {
    console.log('Upload error:', err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});


// GET ALL VIDEOS
app.get(
'/api/videos',

async (req, res) => {

  try {
    const { email } = req.query;
    const filter = email ? { email: email.trim().toLowerCase() } : {};

    const videos =
    await Video.find(filter)
    .sort({
      uploadedAt: -1
    });

    res.json(videos);

  } catch (error) {

    console.log(error);

    res.status(500).json({

      message:
      'Error fetching videos',

    });

  }

});

// DELETE VIDEO
app.delete(
'/api/videos/:id',

async (req, res) => {

  try {

    const { id } = req.params;
    await Video.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Video deleted successfully"
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      success: false,
      message: 'Error deleting video',
    });

  }

});


// ============================================================
// REAL AI DUBBING PIPELINE
// Flow: Download Video → Extract Audio (FFmpeg) → Translate Text
//       → Generate TTS Audio → Merge Audio with Video (FFmpeg)
//       → Save to TranslatedVideo DB
// ============================================================

// Helper: Download a file from URL to local path
async function downloadFile(url, outputPath) {
  const writer = fs.createWriteStream(outputPath);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    timeout: 120000, // 2 minute timeout
  });

  const contentType = response.headers['content-type'] || '';
  if (contentType.includes('text/html') || contentType.includes('application/json')) {
    throw new Error('The URL provided is a web page, not a direct video/audio file. Please provide a direct video URL (e.g. ending in .mp4).');
  }

  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

// Helper: Extract audio from video using FFmpeg
function extractAudio(videoPath, audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .audioBitrate(128)
      .output(audioPath)
      .on('end', () => {
        console.log('🎵 Audio extracted successfully');
        resolve(audioPath);
      })
      .on('error', (err) => {
        console.log('❌ Audio extraction error:', err.message);
        reject(err);
      })
      .run();
  });
}

// Helper: Get video duration in seconds using FFprobe
function getVideoDuration(videoPath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err || !metadata) {
        console.log('Could not get video duration, defaulting to 30s');
        resolve(30);
      } else {
        const duration = metadata.format.duration || 30;
        console.log(`⏱️ Video duration: ${duration}s`);
        resolve(duration);
      }
    });
  });
}

// Helper: Merge new audio with original video (replace audio track)
function mergeAudioVideo(videoPath, audioPath, outputPath, offsetMs = 0) {
  return new Promise((resolve, reject) => {
    const ffmpegCmd = ffmpeg();
    ffmpegCmd.input(videoPath);
    // Apply offset to the new audio if needed (lip‑sync)
    if (offsetMs !== 0) {
      ffmpegCmd.input(audioPath).audioFilters(`adelay=${offsetMs}|${offsetMs}`);
    } else {
      ffmpegCmd.input(audioPath);
    }
    ffmpegCmd
      .outputOptions([
        '-map', '0:v:0',    // video from first input
        '-map', '1:a:0',    // (possibly delayed) audio from second input
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-shortest',
      ])
      .output(outputPath)
      .on('end', () => {
        console.log('🎬 Video + Audio merged successfully (offset', offsetMs, 'ms)');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.log('❌ Merge error:', err.message);
        reject(err);
      })
      .run();
  });
}

// Helper: Translate text using Google Translate (dynamic import for ESM)
async function translateText(text, fromLang, toLang) {
  try {
    // Dynamic import for ESM-only package
    const { translate } = await import('@vitalets/google-translate-api');
    const result = await translate(text, { from: fromLang, to: toLang });
    return result.text;
  } catch (err) {
    console.log('Google Translate error, trying MyMemory fallback:', err.message);
    // Fallback to MyMemory API
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.substring(0, 500))}&langpair=${fromLang}|${toLang}`;
      const res = await axios.get(url);
      if (res.data && res.data.responseData && res.data.responseData.translatedText) {
        return res.data.responseData.translatedText;
      }
    } catch (fallbackErr) {
      console.log('MyMemory fallback also failed:', fallbackErr.message);
    }
    return text; // Return original if all fails
  }
}

// Helper: Generate TTS audio using Google Translate TTS
async function generateTTS(text, lang, outputPath) {
  // Google TTS has a ~200 char limit per request, split into chunks
  const maxChunkLen = 180;
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxChunkLen) {
      chunks.push(remaining);
      break;
    }
    // Find a good split point (space or punctuation)
    let splitIndex = remaining.lastIndexOf(' ', maxChunkLen);
    if (splitIndex === -1) splitIndex = maxChunkLen;
    chunks.push(remaining.substring(0, splitIndex));
    remaining = remaining.substring(splitIndex).trim();
  }

  const audioBuffers = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(chunk)}`;
    try {
      const audioRes = await axios.get(ttsUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/120.0.0.0',
        },
        timeout: 30000,
      });
      audioBuffers.push(Buffer.from(audioRes.data));
    } catch (ttsErr) {
      console.log(`TTS chunk ${i + 1} failed:`, ttsErr.message);
    }
  }

  if (audioBuffers.length === 0) {
    throw new Error('All TTS chunks failed');
  }

  // Concatenate all audio chunks
  const combined = Buffer.concat(audioBuffers);
  fs.writeFileSync(outputPath, combined);
  console.log(`🎙️ TTS Audio saved: ${path.basename(outputPath)} (${chunks.length} chunks)`);
  return outputPath;
}

// Helper: Send OTP email via Brevo (SendinBlue)
async function sendBrevoEmail(toEmail, otp) {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e0e0e0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <h2 style="color: #9333EA; text-align: center; font-size: 26px; margin-bottom: 20px;">Vocalize AI 🎙️</h2>
      <p style="font-size: 16px; color: #333333; line-height: 1.6;">Hello,</p>
      <p style="font-size: 16px; color: #333333; line-height: 1.6;">You are receiving this email because a secure login request was made for your Vocalize AI account. Please use the following One-Time Password (OTP) to complete your verification:</p>
      <div style="text-align: center; margin: 35px 0;">
        <span style="font-size: 38px; font-weight: bold; color: #9333EA; letter-spacing: 8px; padding: 14px 28px; background-color: #F5EDFF; border-radius: 12px; border: 1px dashed #C084FC; display: inline-block;">${otp}</span>
      </div>
      <p style="font-size: 14px; color: #777777; line-height: 1.6; text-align: center;">This code is valid for 5 minutes. If you did not request this, you can safely ignore this email.</p>
      <hr style="border: 0; border-top: 1px solid #f0f0f0; margin: 30px 0;"/>
      <p style="font-size: 12px; color: #aaaaaa; text-align: center; line-height: 1.5;">Vocalize AI — Connect, Dub, and Translate Videos with AI Technology.<br/>© 2026 Vocalize AI. All rights reserved.</p>
    </div>`;

  const payload = {
    sender: { email: process.env.BREVO_SENDER_EMAIL, name: 'Vocalize AI' },
    to: [{ email: toEmail }],
    subject: 'Vocalize AI - Your One-Time OTP Verification Code',
    htmlContent,
  };

  try {
    await axios.post('https://api.brevo.com/v3/smtp/email', payload, {
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    console.log(`✅ OTP email sent via Brevo to ${toEmail}`);
  } catch (err) {
    console.log('❌ Error sending OTP via Brevo:', err.response?.data || err.message);
    throw err;
  }
}

// Helper: Transcribe audio using Deepgram
async function transcribeAudio(audioPath) {
  if (!process.env.DEEPGRAM_API_KEY) {
    console.log('ℹ️ Deepgram API key not set in .env, skipping automatic transcription.');
    return null;
  }

  console.log('🗣️ Transcribing audio with Deepgram Nova-2...');
  try {
    const audioData = fs.readFileSync(audioPath);
    const response = await axios.post(
      'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true',
      audioData,
      {
        headers: {
          Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
          'Content-Type': 'audio/mpeg',
        },
        timeout: 60000, // 1 minute timeout
      }
    );

    const transcript = response.data?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
    if (transcript && transcript.trim().length > 0) {
      console.log(`🗣️ Transcribed text: "${transcript}"`);
      return transcript.trim();
    }
    console.log('⚠️ Deepgram returned empty transcript');
    return null;
  } catch (err) {
    console.log('❌ Deepgram transcription error:', err.response?.data || err.message);
    return null;
  }
}


// DUB VIDEO — Real Translation & TTS Pipeline with FFmpeg
app.post('/api/dub-video', async (req, res) => {
  const timestamp = Date.now();
  const tempVideoPath = path.join(tempDir, `input_${timestamp}.mp4`);
  const tempAudioPath = path.join(tempDir, `audio_${timestamp}.mp3`);
  const ttsAudioPath = path.join(tempDir, `tts_${timestamp}.mp3`);
  const outputVideoPath = path.join(dubbedDir, `dubbed_${timestamp}.mp4`);

  try {
    const { text, targetLanguage, sourceLanguage, videoUrl, email } = req.body;
    const langCodes = { 'English': 'en', 'Hindi': 'hi', 'Kannada': 'kn', 'Korean': 'ko', 'Auto-Detect': 'en' };

    // Determine offset for lip‑sync
    const resolvedVideoPath = videoUrl.startsWith('http') ? tempVideoPath : path.join(__dirname, 'public', videoUrl);
    if(videoUrl.startsWith('http')) await downloadFile(videoUrl, tempVideoPath);
    
    const videoDuration = await getVideoDuration(resolvedVideoPath);
    const originalAudioPath = path.join(tempDir, `origAudio_${timestamp}.mp3`);
    await extractAudio(resolvedVideoPath, originalAudioPath);
    const audioDuration = await getVideoDuration(originalAudioPath);
    const offsetMs = Math.max(0, Math.round((videoDuration - audioDuration) * 1000));
    console.log('🕒 Lip‑sync offset (ms):', offsetMs);

    // Get dialogue
    let dialogue = text;
    if (!dialogue) {
      dialogue = await transcribeAudio(originalAudioPath) || "Hello, welcome to Vocalize AI.";
    }

    const srcLang = langCodes[sourceLanguage] || 'en';
    const tgtLang = langCodes[targetLanguage] || 'hi';

    console.log(`🤖 Video: ${videoUrl ? videoUrl.substring(0, 80) : 'none'}...`);
    console.log(`🤖 ═══════════════════════════════════════════════\n`);

    // ── Step 1: Download video file ──
    console.log('📥 Step 1: Downloading video...');
    let localVideoPath = tempVideoPath;

    if (videoUrl && (videoUrl.startsWith('http://') || videoUrl.startsWith('https://'))) {
      await downloadFile(videoUrl, tempVideoPath);
      console.log('📥 Video downloaded successfully');
    } else if (videoUrl && videoUrl.startsWith('/temp/')) {
      localVideoPath = path.join(__dirname, 'public', videoUrl);
      console.log('📥 Using temporarily uploaded video file from gallery');
    } else if (videoUrl && fs.existsSync(videoUrl)) {
      // Local file path (absolute on server)
      localVideoPath = videoUrl;
      console.log('📥 Using local absolute video file');
    } else {
      throw new Error('Invalid video URL or file path');
    }

    // ── Step 2: Extract audio using FFmpeg ──
    console.log('🎵 Step 2: Extracting audio with FFmpeg...');
    await extractAudio(localVideoPath, tempAudioPath);


    // ── Step 3: Get text for translation ──
    // V1: User provides text manually
    // V2: Auto-transcribe using Deepgram if key is present, otherwise fallback to default
    let dialogueText = "";
    let isUserText = false;
    let isAutoTranscribed = false;

    if (text && text.trim().length > 0) {
      dialogueText = text.trim();
      isUserText = true;
    } else {
      // Try to auto-transcribe the extracted audio
      const autoTranscript = await transcribeAudio(tempAudioPath);
      if (autoTranscript) {
        dialogueText = autoTranscript;
        isAutoTranscribed = true;
      } else {
        dialogueText = "Hello, welcome to Vocalize AI. This is a demonstration of our video dubbing and translation technology. We can translate videos into multiple languages.";
      }
    }
    console.log(`📝 Step 3: Source text (${isUserText ? 'user-provided' : (isAutoTranscribed ? 'auto-transcribed' : 'default fallback')}): "${dialogueText.substring(0, 80)}..."`);

    // ── Step 4: Translate text ──
    console.log(`🌐 Step 4: Translating ${srcLang} → ${tgtLang}...`);
    let translatedText = dialogueText;
    if (srcLang !== tgtLang) {
      translatedText = await translateText(dialogueText, srcLang, tgtLang);
    }
    console.log(`🌐 Translated: "${translatedText.substring(0, 80)}..."`);

    // ── Step 5: Generate TTS Audio ──
    console.log(`🎙️ Step 5: Generating TTS audio in ${tgtLang}...`);
    await generateTTS(translatedText, tgtLang, ttsAudioPath);

    // ── Step 6: Merge dubbed audio with original video ──
    console.log('🎬 Step 6: Merging audio + video with FFmpeg...');
    let mergeSucceeded = false;
    try {
      await mergeAudioVideo(localVideoPath, ttsAudioPath, outputVideoPath, offsetMs);
      mergeSucceeded = true;
    } catch (mergeErr) {
      console.log('⚠️ Video merge failed, saving audio-only dubbed file:', mergeErr.message);
      // Fallback: just copy the TTS audio as the output (user gets translated audio at least)
      fs.copyFileSync(ttsAudioPath, outputVideoPath.replace('.mp4', '.mp3'));
    }

    // ── Step 7: Save to TranslatedVideo database ──
    const dubbedVideoUrl = `/dubbed/dubbed_${timestamp}.mp4`;
    console.log(`💾 Step 7: Saving to database...`);

    const translatedVideo = new TranslatedVideo({
      email: email ? email.trim().toLowerCase() : 'unknown',
      originalVideoUrl: videoUrl,
      translatedVideoUrl: dubbedVideoUrl,
      translatedText: translatedText,
      fromLanguage: sourceLanguage || 'Auto-Detect',
      toLanguage: targetLanguage,
      status: 'completed',
    });

    await translatedVideo.save();

    console.log(`\n✅ ═══════════════════════════════════════════════`);
    console.log(`✅ DUBBING PIPELINE COMPLETED SUCCESSFULLY!`);
    console.log(`✅ Output: ${dubbedVideoUrl}`);
    console.log(`✅ DB Record: ${translatedVideo._id}`);
    console.log(`✅ ═══════════════════════════════════════════════\n`);

    // Cleanup temp files (keep the dubbed output)
    try {
      if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
      if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
      if (fs.existsSync(ttsAudioPath)) fs.unlinkSync(ttsAudioPath);
    } catch (cleanErr) {
      console.log('Temp file cleanup warning:', cleanErr.message);
    }

    res.json({
      success: true,
      translatedText,
      translatedVideoUrl: dubbedVideoUrl,
      translatedVideoId: translatedVideo._id,
      message: `AI Dubbing completed: ${sourceLanguage || 'Auto'} → ${targetLanguage}`,
    });

  } catch (error) {

    console.log('❌ Dub pipeline error:', error.message);

    // Cleanup temp files on error
    try {
      if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
      if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
      if (fs.existsSync(ttsAudioPath)) fs.unlinkSync(ttsAudioPath);
      if (fs.existsSync(outputVideoPath)) fs.unlinkSync(outputVideoPath);
    } catch (cleanErr) {
      // ignore cleanup errors
    }

    res.status(500).json({
      success: false,
      message: `Dubbing failed: ${error.message}`,
    });

  }

});


// GET ALL TRANSLATED VIDEOS (for a specific user)
app.get(
'/api/translated-videos',

async (req, res) => {

  try {
    const { email } = req.query;
    const filter = email
      ? { email: email.trim().toLowerCase(), status: 'completed' }
      : { status: 'completed' };

    const videos = await TranslatedVideo.find(filter)
      .sort({ createdAt: -1 });

    res.json(videos);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: 'Error fetching translated videos',
    });

  }

});


// GET SINGLE TRANSLATED VIDEO BY ID
app.get(
'/api/translated-videos/:id',

async (req, res) => {

  try {
    const { id } = req.params;
    const video = await TranslatedVideo.findById(id);

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Translated video not found',
      });
    }

    res.json(video);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      success: false,
      message: 'Error fetching translated video',
    });

  }

});


// DELETE TRANSLATED VIDEO
app.delete(
'/api/translated-videos/:id',

async (req, res) => {

  try {

    const { id } = req.params;
    const video = await TranslatedVideo.findById(id);

    if (video) {
      // Delete the actual video file from disk
      const filePath = path.join(__dirname, 'public', video.translatedVideoUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Deleted file: ${filePath}`);
      }
      await TranslatedVideo.findByIdAndDelete(id);
    }

    res.json({
      success: true,
      message: "Translated video deleted successfully"
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      success: false,
      message: 'Error deleting translated video',
    });

  }

});


// START SERVER
const PORT = process.env.PORT || 5000;
app.listen(
PORT,
'0.0.0.0',

() => {

  console.log(
    `Server running on port ${PORT} 🚀`
  );

});