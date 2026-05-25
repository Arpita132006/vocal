import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import axios from 'axios';
import { BASE_URL } from '@/services/api';
import { getUserSession } from '@/services/storage';
import { useIsFocused } from '@react-navigation/native';
import Footer from '@/components/Footer';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');

export default function UploadScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ videoUrl?: string }>();
  const videoRef = useRef<Video>(null);
  const translatedVideoRef = useRef<Video>(null);

  // Video state
  const [sourceLanguage, setSourceLanguage] = useState('English');
  const [targetLanguage, setTargetLanguage] = useState('Hindi');
  const [videoUri, setVideoUri] = useState<string | null>(null);

  useEffect(() => {
    if (params.videoUrl) {
      setVideoUri(params.videoUrl);
      setSourceLanguage("Auto-Detect");
      setShowTranslatedVideo(false);
      setTranslatedVideoUrl(null);
    }
  }, [params.videoUrl]);

  // URL Modal
  const [isUrlModalVisible, setIsUrlModalVisible] = useState(false);
  const [inputUrl, setInputUrl] = useState('');

  // Language dropdown
  const [userLanguages, setUserLanguages] = useState<string[]>(['English', 'Hindi', 'Kannada']);
  const [isLanguageDropdownVisible, setIsLanguageDropdownVisible] = useState(false);
  const [isSourceLangDropdownVisible, setIsSourceLangDropdownVisible] = useState(false);

  // Dialogue text input (V1: user types text, V2: Whisper auto-transcribes)
  const [dialogueText, setDialogueText] = useState('');
  const [isTextInputVisible, setIsTextInputVisible] = useState(true);

  // Dubbing states
  const [isDubbing, setIsDubbing] = useState(false);
  const [dubbingLog, setDubbingLog] = useState<string>('');
  const [dubbingStep, setDubbingStep] = useState(0);
  const [userEmail, setUserEmail] = useState('user@example.com');

  // Translated video result
  const [translatedVideoUrl, setTranslatedVideoUrl] = useState<string | null>(null);
  const [translatedText, setTranslatedText] = useState<string>('');
  const [showTranslatedVideo, setShowTranslatedVideo] = useState(false);

  useEffect(() => {
    loadUserProfile();
  }, []);

  // Cleanup video players when leaving screen
  useEffect(() => {
    if (!isFocused) {
      stopAllMedia();
    }
    return () => {
      stopAllMedia();
    };
  }, [isFocused]);

  const stopAllMedia = async () => {
    try {
      if (videoRef.current) {
        await videoRef.current.stopAsync();
        await videoRef.current.unloadAsync();
      }
    } catch (e) {
      // Player may already be unloaded
    }
    try {
      if (translatedVideoRef.current) {
        await translatedVideoRef.current.stopAsync();
        await translatedVideoRef.current.unloadAsync();
      }
    } catch (e) {
      // Player may already be unloaded
    }
  };

  // Fetch languages user selected in profile screen
  const loadUserProfile = async () => {
    try {
      const email = await getUserSession();
      if (email) {
        setUserEmail(email);
        const response = await axios.post(`${BASE_URL}/check-user`, { email });
        if (response.data.exists && response.data.user) {
          const u = response.data.user;
          if (u.languages && u.languages.length > 0) {
            setUserLanguages(u.languages);
            setTargetLanguage(u.languages[0]);
          }
        }
      }
    } catch (err) {
      console.log('Error loading user profile in upload:', err);
    }
  };

  // Pick video from library
  const pickVideoFromGallery = async () => {
    await stopAllMedia();

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      alert("Permission to access camera roll is required! 📸");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setVideoUri(result.assets[0].uri);
      setSourceLanguage("Auto-Detect");
      setShowTranslatedVideo(false);
      setTranslatedVideoUrl(null);
    }
  };

  // Load video from URL
  const handleLoadUrl = () => {
    if (!inputUrl.trim()) {
      alert("Please paste a valid video URL ❌");
      return;
    }
    stopAllMedia();
    setVideoUri(inputUrl.trim());
    setSourceLanguage("Auto-Detect");
    setIsUrlModalVisible(false);
    setInputUrl('');
    setShowTranslatedVideo(false);
    setTranslatedVideoUrl(null);
    alert("Video URL loaded successfully! 🔗");
  };

  // Handle REAL AI Dubbing via backend
  const handleDubAndPublish = async () => {
    if (!videoUri) {
      alert("Please select or link a video first ❌");
      return;
    }

    setIsDubbing(true);
    setDubbingStep(0);

    // Show real pipeline steps
    const logs = [
      "📥 Step 1: Downloading video for processing...",
      "🎵 Step 2: Extracting audio from video using FFmpeg...",
      "📝 Step 3: Preparing dialogue text for translation...",
      `🌐 Step 4: Translating text to ${targetLanguage} using Google Translate...`,
      `🎙️ Step 5: Generating speech in ${targetLanguage} using TTS...`,
      "🎬 Step 6: Merging new audio with original video using FFmpeg...",
      "💾 Step 7: Saving translated video to database...",
    ];

    // Show animated logs while the actual API call runs
    const logInterval = setInterval(() => {
      setDubbingStep((prev) => {
        const next = Math.min(prev + 1, logs.length - 1);
        setDubbingLog(logs[next]);
        return next;
      });
    }, 3000);

    setDubbingLog(logs[0]);

    try {
      let finalVideoUrl = videoUri;

      // Upload local gallery file to server temp storage first
      if (videoUri.startsWith('file://')) {
        const formData = new FormData();
        formData.append('video', {
          uri: videoUri,
          name: 'upload.mp4',
          type: 'video/mp4',
        } as any);

        console.log('🤖 Uploading local video to server...');
        const uploadRes = await axios.post(`${BASE_URL}/api/upload-temp`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120000,
        });
        
        if (uploadRes.data.success) {
          finalVideoUrl = uploadRes.data.videoUrl;
          
          // Save ORIGINAL uploaded video to 'My Videos' feed
          try {
            await axios.post(`${BASE_URL}/save-video`, {
              email: userEmail,
              videoUrl: `${BASE_URL}${finalVideoUrl}`,
              caption: `Original Uploaded Video`,
              language: sourceLanguage || 'Auto-Detect',
            });
          } catch (saveErr) {
            console.log('Original feed save warning:', saveErr);
          }
        } else {
          throw new Error('Failed to upload video to server');
        }
      }

      // Call the REAL backend dubbing API
      const payload = {
        videoUrl: finalVideoUrl,
        targetLanguage: targetLanguage,
        sourceLanguage: sourceLanguage,
        text: dialogueText || undefined,
        email: userEmail,
      };

      console.log('🤖 Sending dub request to backend:', JSON.stringify(payload).substring(0, 200));

      const response = await axios.post(`${BASE_URL}/api/dub-video`, payload, {
        timeout: 300000, // 5 minute timeout for long videos
      });

      clearInterval(logInterval);

      if (response.data.success) {
        const fullVideoUrl = `${BASE_URL}${response.data.translatedVideoUrl}`;
        setTranslatedVideoUrl(fullVideoUrl);
        setTranslatedText(response.data.translatedText || '');
        setShowTranslatedVideo(true);
        setIsDubbing(false);


        Alert.alert(
          "Dubbing Complete! 🎉",
          `Video successfully dubbed into ${targetLanguage}!\n\nTranslated text:\n"${(response.data.translatedText || '').substring(0, 100)}..."`,
          [{ text: "Watch Now", style: "default" }]
        );
      } else {
        clearInterval(logInterval);
        setIsDubbing(false);
        alert(`Dubbing failed: ${response.data.message || 'Unknown error'} ❌`);
      }
    } catch (err: any) {
      clearInterval(logInterval);
      setIsDubbing(false);
      console.log('Dubbing error:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Network error';
      alert(`Dubbing error: ${errorMsg} ❌`);
    }
  };

  // Go back — stop everything
  const handleBack = async () => {
    await stopAllMedia();
    if (showTranslatedVideo) {
      setShowTranslatedVideo(false);
    } else if (videoUri) {
      setVideoUri(null);
      setDialogueText('');
    } else {
      router.back();
    }
  };

  // Replay translated video
  const handleReplay = async () => {
    try {
      if (translatedVideoRef.current) {
        await translatedVideoRef.current.replayAsync();
      }
    } catch (e) {
      console.log('Replay error:', e);
    }
  };

  return (
    <View style={styles.outerContainer}>

      {/* ═══ TRANSLATED VIDEO RESULT SCREEN ═══ */}
      {showTranslatedVideo && translatedVideoUrl ? (
        <View style={styles.reelsPreviewContainer}>
          <Video
            ref={translatedVideoRef}
            source={{ uri: translatedVideoUrl }}
            style={styles.fullReelsPlayer}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={isFocused}
            isLooping
            useNativeControls={false}
          />

          {/* Header */}
          <View style={styles.reelsHeader}>
            <TouchableOpacity onPress={handleBack} style={styles.backBtnBg}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.translatedBadge}>
              <Text style={styles.translatedBadgeText}>✅ Dubbed in {targetLanguage}</Text>
            </View>
          </View>

          {/* Bottom Controls */}
          <View style={styles.translatedOverlay}>
            {/* Translated text preview */}
            {translatedText ? (
              <View style={styles.translatedTextCard}>
                <Text style={styles.translatedTextLabel}>Translated Text:</Text>
                <Text style={styles.translatedTextContent} numberOfLines={3}>
                  {translatedText}
                </Text>
              </View>
            ) : null}

            <View style={styles.translatedBtnRow}>
              <TouchableOpacity style={styles.replayBtn} onPress={handleReplay}>
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={styles.replayBtnText}>Replay</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.homeBtn}
                onPress={async () => {
                  await stopAllMedia();
                  router.push('/home');
                }}
              >
                <Ionicons name="home" size={20} color="#fff" />
                <Text style={styles.homeBtnText}>Go to Feed</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

      ) : videoUri ? (
        /* ═══ VIDEO PREVIEW + DUB CONTROLS ═══ */
        <View style={styles.reelsPreviewContainer}>
          <Video
            ref={videoRef}
            source={{ uri: videoUri }}
            style={styles.fullReelsPlayer}
            resizeMode={ResizeMode.COVER}
            shouldPlay={isFocused && !isDubbing}
            isLooping
            useNativeControls={false}
          />

          {/* HEADER ROW OVERLAY */}
          <View style={styles.reelsHeader}>
            <TouchableOpacity onPress={handleBack} style={styles.backBtnBg}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            {/* Target Language Selector */}
            <TouchableOpacity
              style={styles.langSelectBtn}
              onPress={() => setIsLanguageDropdownVisible(!isLanguageDropdownVisible)}
            >
              <Text style={styles.langSelectBtnText}>🌐 {targetLanguage}</Text>
            </TouchableOpacity>
          </View>

          {/* Language Dropdown */}
          {isLanguageDropdownVisible && (
            <View style={styles.floatingDropdown}>
              {userLanguages.map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[styles.dropdownItem, targetLanguage === lang && styles.dropdownItemSelected]}
                  onPress={() => {
                    setTargetLanguage(lang);
                    setIsLanguageDropdownVisible(false);
                  }}
                >
                  <Text style={[styles.dropdownText, targetLanguage === lang && styles.dropdownTextActive]}>
                    {lang}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* TOP DUB CONTROLS (Dialogue Text) */}
          <View style={{ position: 'absolute', top: 100, left: 20, right: 20, zIndex: 10 }}>
            {/* Text input toggle */}
            <TouchableOpacity
              style={styles.textInputToggle}
              onPress={() => setIsTextInputVisible(!isTextInputVisible)}
            >
              <Ionicons name="document-text" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.textInputToggleText}>
                {dialogueText ? '✅ Dialogue text added' : 'Add dialogue text (optional)'}
              </Text>
              <Ionicons name={isTextInputVisible ? "chevron-up" : "chevron-down"} size={16} color="#fff" />
            </TouchableOpacity>

            {isTextInputVisible && (
              <TextInput
                style={styles.dialogueInput}
                placeholder="Type or paste the video's dialogue here... (optional — helps improve translation accuracy)"
                placeholderTextColor="#999"
                value={dialogueText}
                onChangeText={setDialogueText}
                multiline
                numberOfLines={3}
              />
            )}
          </View>

          {/* BOTTOM DUB CONTROLS OVERLAY */}
          <View style={styles.reelsEditorOverlay}>

            {/* Source / Target badges */}
            <View style={styles.metaBadgeRow}>
              <TouchableOpacity
                style={styles.detectBadge}
                onPress={() => setIsSourceLangDropdownVisible(!isSourceLangDropdownVisible)}
              >
                <Text style={styles.detectBadgeText}>Source: {sourceLanguage}</Text>
              </TouchableOpacity>
              <View style={styles.arrowBadge}>
                <Ionicons name="arrow-forward" size={12} color="#fff" />
              </View>
              <View style={styles.targetBadge}>
                <Text style={styles.targetBadgeText}>Target: {targetLanguage}</Text>
              </View>
            </View>

            {/* Source language dropdown */}
            {isSourceLangDropdownVisible && (
              <View style={styles.sourceLangDropdown}>
                {['Auto-Detect', 'English', 'Hindi', 'Kannada'].map((lang) => (
                  <TouchableOpacity
                    key={lang}
                    style={[styles.dropdownItem, sourceLanguage === lang && styles.dropdownItemSelected]}
                    onPress={() => {
                      setSourceLanguage(lang);
                      setIsSourceLangDropdownVisible(false);
                    }}
                  >
                    <Text style={[styles.dropdownText, sourceLanguage === lang && styles.dropdownTextActive]}>
                      {lang}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* DUB BUTTON */}
            <TouchableOpacity style={styles.dubActionBtn} onPress={handleDubAndPublish}>
              <Ionicons name="language" size={22} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.dubActionBtnText}>Dub & Translate → {targetLanguage}</Text>
            </TouchableOpacity>

          </View>
        </View>
      ) : (
        /* ═══ VIDEO SOURCE SELECTION SCREEN ═══ */
        <ScrollView contentContainerStyle={styles.container}>
          {/* BACKGROUND GRAPHICS */}
          <View style={styles.circle1} />
          <View style={styles.circle2} />

          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
              <Ionicons name="arrow-back" size={24} color="#9333EA" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Vocalize AI</Text>
            <View style={{ width: 44 }} />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Select Video Source</Text>

              <TouchableOpacity style={[styles.sourceBtn, { width: '100%', marginBottom: 10 }]} onPress={pickVideoFromGallery}>
                <Ionicons name="images" size={32} color="#9333EA" />
                <Text style={styles.sourceBtnText}>Device Gallery</Text>
              </TouchableOpacity>

            {/* Quick sample for testing */}
            <Text style={styles.label}>Or Try a Sample Video 🎬</Text>
            <Text style={styles.sampleSub}>Test the dubbing pipeline with a sample video.</Text>

            <TouchableOpacity
              style={styles.sampleCard}
              onPress={() => {
                stopAllMedia();
                setVideoUri('https://www.w3schools.com/html/mov_bbb.mp4');
                setSourceLanguage('English');
                setShowTranslatedVideo(false);
                setTranslatedVideoUrl(null);
              }}
            >
              <View style={styles.sampleAvatar}>
                <Ionicons name="film" size={20} color="#9333EA" />
              </View>
              <View style={styles.sampleCardInfo}>
                <Text style={styles.sampleTitle}>🎬 Sample Video (English)</Text>
                <Text style={styles.sampleCap}>Short sample video for testing dubbing pipeline</Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}



      {/* AI DUBBING PROGRESS OVERLAY */}
      <Modal visible={isDubbing} transparent>
        <View style={styles.loaderOverlay}>
          <View style={styles.loaderContent}>
            <ActivityIndicator size="large" color="#9333EA" />
            <Text style={styles.loaderTitle}>🤖 AI Dubbing in Progress...</Text>
            <View style={styles.logCard}>
              <Text style={styles.logText}>{dubbingLog}</Text>
            </View>
            <Text style={styles.loaderHint}>
              This may take 30-90 seconds depending on video length.
            </Text>

            {/* Progress dots */}
            <View style={styles.progressRow}>
              {[1, 2, 3, 4, 5, 6, 7].map((step) => (
                <View
                  key={step}
                  style={[
                    styles.progressDot,
                    step <= dubbingStep + 1 && styles.progressDotActive,
                  ]}
                />
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* BOTTOM TAB FOOTER (hidden when showing translated video) */}
      {!showTranslatedVideo && <Footer />}
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#F5EDFF',
  },
  container: {
    flexGrow: 1,
    paddingTop: 50,
    paddingBottom: 110,
    alignItems: 'center',
  },
  circle1: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#C084FC',
    top: -60,
    left: -60,
    opacity: 0.35,
  },
  circle2: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#FF4D9D',
    bottom: -100,
    right: -80,
    opacity: 0.2,
  },
  // REELS PREVIEW CONTAINER (FULL BLEED LAYOUT)
  reelsPreviewContainer: {
    width,
    height,
    backgroundColor: '#000',
    position: 'relative',
  },
  fullReelsPlayer: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  reelsHeader: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 100,
  },
  backBtnBg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  langSelectBtn: {
    backgroundColor: 'rgba(147, 51, 234, 0.85)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    elevation: 3,
  },
  langSelectBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  floatingDropdown: {
    position: 'absolute',
    top: 100,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    elevation: 8,
    width: 140,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 6,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  dropdownItemSelected: {
    backgroundColor: '#F5EDFF',
  },
  dropdownText: {
    color: '#333',
    fontWeight: '500',
  },
  dropdownTextActive: {
    color: '#9333EA',
    fontWeight: 'bold',
  },
  // REELS EDITOR CONTROLS OVERLAY
  reelsEditorOverlay: {
    position: 'absolute',
    bottom: 110,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 10,
  },
  metaBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detectBadge: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  detectBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  arrowBadge: {
    marginHorizontal: 8,
  },
  targetBadge: {
    backgroundColor: 'rgba(147, 51, 234, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  targetBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  sourceLangDropdown: {
    backgroundColor: '#fff',
    borderRadius: 16,
    elevation: 8,
    width: '100%',
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 6,
    marginBottom: 12,
  },
  // Text input toggle
  textInputToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderWidth: 1,
    borderColor: '#C084FC',
    marginBottom: 10,
    width: '100%',
  },
  textInputToggleText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    flex: 1,
  },
  dialogueInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    color: '#333',
    width: '100%',
    minHeight: 70,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#C084FC',
    textAlignVertical: 'top',
  },
  dubActionBtn: {
    backgroundColor: '#9333EA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 20,
    width: '100%',
    elevation: 4,
  },
  dubActionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  // TRANSLATED VIDEO OVERLAY
  translatedBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  translatedBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  translatedOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 10,
  },
  translatedTextCard: {
    width: '100%',
    padding: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#22C55E',
  },
  translatedTextLabel: {
    color: '#22C55E',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  translatedTextContent: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
  },
  translatedBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  replayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(147, 51, 234, 0.9)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 18,
    flex: 0.48,
    elevation: 3,
  },
  replayBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 8,
  },
  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 18,
    flex: 0.48,
    elevation: 3,
  },
  homeBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 8,
  },
  // SOURCING SCREEN ELEMENTS
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: width * 0.9,
    marginBottom: 15,
    zIndex: 100,
  },
  headerIcon: {
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 20,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#9333EA',
  },
  card: {
    width: width * 0.9,
    backgroundColor: 'rgba(255,255,255,0.88)',
    padding: 24,
    borderRadius: 30,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  selectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sourceBtn: {
    backgroundColor: '#fff',
    width: '47%',
    height: 110,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  sourceBtnText: {
    marginTop: 8,
    color: '#333',
    fontWeight: '600',
    fontSize: 13,
  },
  // SAMPLE LISTINGS
  sampleSub: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
    marginBottom: 14,
  },
  sampleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  sampleAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5EDFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sampleCardInfo: {
    flex: 1,
  },
  sampleTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  sampleCap: {
    fontSize: 11,
    color: '#777',
    marginTop: 2,
  },
  // LINK MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.85,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#9333EA',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#C084FC',
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    marginBottom: 20,
    color: '#333',
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalBtn: {
    width: '47%',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: '#ECECEC',
  },
  modalBtnCancelText: {
    color: '#555',
    fontWeight: '600',
  },
  modalBtnLoad: {
    backgroundColor: '#9333EA',
  },
  modalBtnLoadText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  // LOADER OVERLAYS
  loaderOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderContent: {
    width: width * 0.85,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    elevation: 8,
  },
  loaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    marginBottom: 20,
  },
  logCard: {
    width: '100%',
    padding: 16,
    backgroundColor: '#F5EDFF',
    borderRadius: 14,
    borderLeftWidth: 4,
    borderColor: '#9333EA',
  },
  logText: {
    color: '#9333EA',
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  loaderHint: {
    color: '#999',
    fontSize: 11,
    marginTop: 14,
    textAlign: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    marginTop: 16,
    alignItems: 'center',
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4,
  },
  progressDotActive: {
    backgroundColor: '#9333EA',
  },
});
