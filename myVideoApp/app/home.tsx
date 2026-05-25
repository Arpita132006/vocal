import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { BASE_URL } from '@/services/api';
import { getUserSession } from '@/services/storage';
import Footer from '@/components/Footer';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');

interface VideoItem {
  _id: string;
  email: string;
  videoUrl: string;
  caption: string;
  language: string;
  likes: number;
  comments: number;
  shares: number;
  uploadedAt: string;
}

interface TranslatedVideoItem {
  _id: string;
  email: string;
  originalVideoUrl: string;
  translatedVideoUrl: string;
  translatedText: string;
  fromLanguage: string;
  toLanguage: string;
  status: string;
  createdAt: string;
}

export default function Home() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [translatedVideos, setTranslatedVideos] = useState<TranslatedVideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'uploads' | 'translated'>('uploads');
  const videoRefs = useRef<{ [key: string]: Video | null }>({});

  useEffect(() => {
    if (isFocused) {
      loadUserAndVideos();
    } else {
      // Pause all videos when user navigates away
      setActiveVideoId(null);
      stopAllVideos();
    }
    return () => {
      stopAllVideos();
    };
  }, [isFocused]);

  const stopAllVideos = useCallback(async () => {
    for (const key of Object.keys(videoRefs.current)) {
      try {
        const ref = videoRefs.current[key];
        if (ref) {
          await ref.stopAsync();
        }
      } catch (e) {
        // Player may already be unloaded
      }
    }
  }, []);

  const loadUserAndVideos = async () => {
    try {
      setLoading(true);
      const savedEmail = await getUserSession();
      if (savedEmail) {
        // Fetch user's uploaded videos
        const videosRes = await axios.get(`${BASE_URL}/api/videos`, {
          params: { email: savedEmail },
        });
        setVideos(videosRes.data);

        // Fetch user's translated/dubbed videos
        try {
          const translatedRes = await axios.get(`${BASE_URL}/api/translated-videos`, {
            params: { email: savedEmail },
          });
          setTranslatedVideos(translatedRes.data);
        } catch (tErr) {
          console.log('Error fetching translated videos:', tErr);
          setTranslatedVideos([]);
        }

        // Auto-play first video
        const allData = videosRes.data;
        if (allData.length > 0 && !activeVideoId) {
          setActiveVideoId(allData[0]._id);
        }
      } else {
        router.replace('/');
      }
    } catch (error) {
      console.log('Error loading user/videos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Delete video from MongoDB
  const handleDeleteVideo = (videoId: string) => {
    Alert.alert(
      "Delete Video",
      "Are you sure you want to delete this video? 🗑️",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await axios.delete(`${BASE_URL}/api/videos/${videoId}`);
              if (res.data.success) {
                alert("Video deleted successfully! 🗑️");
                setVideos(prev => prev.filter(v => v._id !== videoId));
                if (activeVideoId === videoId) {
                  setActiveVideoId(null);
                }
              } else {
                alert("Failed to delete video ❌");
              }
            } catch (err) {
              console.log('Error deleting video:', err);
              alert("Error deleting video ❌");
            }
          }
        }
      ]
    );
  };

  // Delete translated video
  const handleDeleteTranslatedVideo = (videoId: string) => {
    Alert.alert(
      "Delete Translated Video",
      "Are you sure you want to delete this dubbed video? 🗑️",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await axios.delete(`${BASE_URL}/api/translated-videos/${videoId}`);
              if (res.data.success) {
                alert("Translated video deleted! 🗑️");
                setTranslatedVideos(prev => prev.filter(v => v._id !== videoId));
                if (activeVideoId === videoId) {
                  setActiveVideoId(null);
                }
              } else {
                alert("Failed to delete ❌");
              }
            } catch (err) {
              console.log('Error deleting translated video:', err);
              alert("Error deleting translated video ❌");
            }
          }
        }
      ]
    );
  };

  const renderVideoItem = ({ item }: { item: VideoItem }) => {
    const isPlaying = isFocused && activeVideoId === item._id;

    return (
      <View style={styles.videoCard}>
        <View style={styles.playerContainer}>
          <Video
            ref={(ref) => { videoRefs.current[item._id] = ref; }}
            source={{ uri: item.videoUrl }}
            style={styles.videoPlayer}
            resizeMode={ResizeMode.COVER}
            shouldPlay={isPlaying}
            isLooping
            useNativeControls={false}
          />

          {/* PLAY/PAUSE TAP OVERLAY (NOW OPENS DUBBING SCREEN) */}
          <TouchableOpacity
            style={styles.playOverlay}
            activeOpacity={0.9}
            onPress={() => {
              stopAllVideos();
              router.push({
                pathname: '/upload',
                params: { videoUrl: item.videoUrl },
              } as any);
            }}
          >
            {!isPlaying && (
              <View style={styles.playButtonBg}>
                <Ionicons name="play" size={32} color="#fff" style={{ marginLeft: 3 }} />
              </View>
            )}
          </TouchableOpacity>

          {/* DELETE BUTTON */}
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteVideo(item._id)}
          >
            <Ionicons name="trash" size={20} color="#FF4D9D" />
          </TouchableOpacity>
        </View>

        {/* CARD META */}
        <View style={styles.metaBlock}>
          <Text style={styles.videoCaption}>{item.caption}</Text>
          <View style={styles.metaRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>🎙️ {item.language}</Text>
              </View>
              <TouchableOpacity 
                style={[styles.viewDetailsBtn, { backgroundColor: '#9333EA', marginLeft: 10 }]}
                onPress={() => {
                  stopAllVideos();
                  router.push({
                    pathname: '/upload',
                    params: { videoUrl: item.videoUrl },
                  } as any);
                }}
              >
                <Text style={styles.viewDetailsBtnText}>Dub Video →</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statIcon}>
                <Ionicons name="heart" size={18} color="#FF4D9D" />
                <Text style={styles.statText}>{item.likes || 0}</Text>
              </View>
              <View style={styles.statIcon}>
                <Ionicons name="chatbubble" size={18} color="#9333EA" />
                <Text style={styles.statText}>{item.comments || 0}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderTranslatedVideoItem = ({ item }: { item: TranslatedVideoItem }) => {
    const videoUrl = item.translatedVideoUrl.startsWith('http')
      ? item.translatedVideoUrl
      : `${BASE_URL}${item.translatedVideoUrl}`;
    const isPlaying = isFocused && activeVideoId === item._id;

    return (
      <View style={styles.videoCard}>
        <View style={styles.playerContainer}>
          <Video
            ref={(ref) => { videoRefs.current[item._id] = ref; }}
            source={{ uri: videoUrl }}
            style={styles.videoPlayer}
            resizeMode={ResizeMode.COVER}
            shouldPlay={isPlaying}
            isLooping
            useNativeControls={false}
          />

          {/* PLAY/PAUSE TAP OVERLAY */}
          <TouchableOpacity
            style={styles.playOverlay}
            activeOpacity={0.9}
            onPress={() => setActiveVideoId(isPlaying ? null : item._id)}
          >
            {!isPlaying && (
              <View style={styles.playButtonBg}>
                <Ionicons name="play" size={32} color="#fff" style={{ marginLeft: 3 }} />
              </View>
            )}
          </TouchableOpacity>

          {/* DUBBED BADGE */}
          <View style={styles.dubbedBadgeOverlay}>
            <Text style={styles.dubbedBadgeText}>
              ✅ {item.fromLanguage} → {item.toLanguage}
            </Text>
          </View>

          {/* DELETE BUTTON */}
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteTranslatedVideo(item._id)}
          >
            <Ionicons name="trash" size={20} color="#FF4D9D" />
          </TouchableOpacity>
        </View>

        {/* CARD META */}
        <View style={styles.metaBlock}>
          <Text style={styles.videoCaption}>
            AI Dubbed: {item.fromLanguage} → {item.toLanguage}
          </Text>
          {item.translatedText ? (
            <Text style={styles.translatedPreview} numberOfLines={2}>
              "{item.translatedText}"
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <View style={[styles.badge, styles.translatedBadgeMeta]}>
              <Text style={[styles.badgeText, { color: '#22C55E' }]}>🌐 Translated</Text>
            </View>
            <TouchableOpacity
              style={styles.viewDetailsBtn}
              onPress={() => {
                stopAllVideos();
                router.push({
                  pathname: '/translatedvideo',
                  params: { id: item._id },
                } as any);
              }}
            >
              <Text style={styles.viewDetailsBtnText}>View Details →</Text>
            </TouchableOpacity>
          </View>
          </View>
        </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* BACKGROUND FLOATING GRADIENT BUBBLES */}
      <View style={styles.circle1} />
      <View style={styles.circle2} />
      <View style={styles.circle3} />

      {/* TOP BRANDING HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIcon}>
          <Ionicons name="musical-notes" size={26} color="#9333EA" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vocalize AI</Text>
        <TouchableOpacity style={styles.headerIcon} onPress={loadUserAndVideos}>
          <Ionicons name="refresh" size={24} color="#9333EA" />
        </TouchableOpacity>
      </View>

      {/* TAB SWITCHER: Uploads vs Translated */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'uploads' && styles.tabActive]}
          onPress={() => { setActiveTab('uploads'); setActiveVideoId(null); }}
        >
          <Text style={[styles.tabText, activeTab === 'uploads' && styles.tabTextActive]}>
            📹 My Videos ({videos.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'translated' && styles.tabActive]}
          onPress={() => { setActiveTab('translated'); setActiveVideoId(null); }}
        >
          <Text style={[styles.tabText, activeTab === 'translated' && styles.tabTextActive]}>
            🌐 Dubbed ({translatedVideos.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* CARD FEED VIEW */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#9333EA" />
          <Text style={styles.loadingText}>Loading your feed...</Text>
        </View>
      ) : activeTab === 'uploads' ? (
        videos.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBg}>
              <Ionicons name="film-outline" size={60} color="#9333EA" />
            </View>
            <Text style={styles.emptyTitle}>No Uploads Yet</Text>
            <Text style={styles.emptySubtitle}>
              Get started by selecting from your gallery or pasting a video link to dub!
            </Text>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => router.push('/upload' as any)}
            >
              <Text style={styles.uploadButtonText}>Create a Dubbed Video 🚀</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={videos}
            renderItem={renderVideoItem}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : (
        translatedVideos.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBg}>
              <Ionicons name="language-outline" size={60} color="#9333EA" />
            </View>
            <Text style={styles.emptyTitle}>No Dubbed Videos Yet</Text>
            <Text style={styles.emptySubtitle}>
              Upload a video and translate it to see your dubbed videos here!
            </Text>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => router.push('/upload' as any)}
            >
              <Text style={styles.uploadButtonText}>Dub Your First Video 🚀</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={translatedVideos}
            renderItem={renderTranslatedVideoItem}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )
      )}

      {/* ABSOLUTE PILL FOOTER TAB NAVIGATION */}
      <Footer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5EDFF',
    paddingTop: 50,
  },
  // BUBBLES
  circle1: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#C084FC',
    top: -50,
    left: -60,
    opacity: 0.35,
  },
  circle2: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#FF4D9D',
    top: 220,
    right: -70,
    opacity: 0.2,
  },
  circle3: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#9333EA',
    bottom: -60,
    left: 40,
    opacity: 0.15,
  },
  // HEADER
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    height: 60,
    zIndex: 10,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#9333EA',
    letterSpacing: 0.5,
  },
  // TAB SWITCHER
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 16,
    padding: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: '#9333EA',
    elevation: 3,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  // FEED CONTAINER
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 110,
  },
  videoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 30,
    marginBottom: 20,
    overflow: 'hidden',
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  playerContainer: {
    height: height * 0.38,
    backgroundColor: '#000',
    position: 'relative',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  playOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  playButtonBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(147, 51, 234, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  deleteButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    zIndex: 100,
  },
  dubbedBadgeOverlay: {
    position: 'absolute',
    top: 15,
    left: 15,
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    zIndex: 50,
  },
  dubbedBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  metaBlock: {
    padding: 18,
    backgroundColor: '#fff',
  },
  videoCaption: {
    color: '#222',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  translatedPreview: {
    color: '#555',
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 8,
    lineHeight: 17,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  badge: {
    backgroundColor: '#F5EDFF',
    borderWidth: 1,
    borderColor: '#C084FC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  translatedBadgeMeta: {
    borderColor: '#22C55E',
    backgroundColor: '#F0FFF4',
  },
  badgeText: {
    color: '#9333EA',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dateText: {
    color: '#999',
    fontSize: 11,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 14,
  },
  statText: {
    color: '#555',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  // EMPTY & LOADING
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#555',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 0.8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    zIndex: 10,
  },
  emptyIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 4,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  uploadButton: {
    backgroundColor: '#9333EA',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 18,
    elevation: 4,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  viewDetailsBtn: {
    backgroundColor: '#9333EA',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  viewDetailsBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});