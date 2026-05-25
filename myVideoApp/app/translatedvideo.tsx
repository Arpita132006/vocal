import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import axios from 'axios';
import { BASE_URL } from '@/services/api';
import { useIsFocused } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');

export default function TranslatedVideoScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const videoRef = useRef<Video>(null);
  const { id } = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [videoData, setVideoData] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchVideoDetails();
    }
  }, [id]);

  useEffect(() => {
    if (!isFocused) {
      pauseVideo();
    }
    return () => {
      cleanupVideo();
    };
  }, [isFocused]);

  const fetchVideoDetails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BASE_URL}/api/translated-videos/${id}`);
      setVideoData(response.data);
      setError(null);
    } catch (err: any) {
      console.log('Error fetching translated video:', err);
      setError('Could not load translated video');
    } finally {
      setLoading(false);
    }
  };

  const pauseVideo = async () => {
    try {
      if (videoRef.current) {
        await videoRef.current.pauseAsync();
      }
    } catch (e) {}
  };

  const cleanupVideo = async () => {
    try {
      if (videoRef.current) {
        await videoRef.current.stopAsync();
        await videoRef.current.unloadAsync();
      }
    } catch (e) {}
  };

  const handlePlayPause = async () => {
    try {
      if (videoRef.current) {
        if (isPlaying) {
          await videoRef.current.pauseAsync();
        } else {
          await videoRef.current.playAsync();
        }
        setIsPlaying(!isPlaying);
      }
    } catch (e) {
      console.log('Play/pause error:', e);
    }
  };

  const handleReplay = async () => {
    try {
      if (videoRef.current) {
        await videoRef.current.replayAsync();
        setIsPlaying(true);
      }
    } catch (e) {
      console.log('Replay error:', e);
    }
  };

  const handleDelete = () => {
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
              await cleanupVideo();
              const res = await axios.delete(`${BASE_URL}/api/translated-videos/${id}`);
              if (res.data.success) {
                alert("Translated video deleted! 🗑️");
                router.back();
              }
            } catch (err) {
              alert("Error deleting video ❌");
            }
          }
        }
      ]
    );
  };

  const handleGoBack = async () => {
    await cleanupVideo();
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.centerLoader}>
        <ActivityIndicator size="large" color="#9333EA" />
        <Text style={styles.loadingText}>Loading translated video...</Text>
      </View>
    );
  }

  if (error || !videoData) {
    return (
      <View style={styles.centerLoader}>
        <Ionicons name="alert-circle" size={60} color="#FF4D9D" />
        <Text style={styles.errorText}>{error || 'Video not found'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const videoUrl = videoData.translatedVideoUrl.startsWith('http')
    ? videoData.translatedVideoUrl
    : `${BASE_URL}${videoData.translatedVideoUrl}`;

  return (
    <View style={styles.container}>
      {/* Video Player */}
      <View style={styles.videoContainer}>
        <Video
          ref={videoRef}
          source={{ uri: videoUrl }}
          style={styles.videoPlayer}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={isFocused && isPlaying}
          isLooping
          useNativeControls={false}
        />

        {/* Header overlay */}
        <View style={styles.headerOverlay}>
          <TouchableOpacity onPress={handleGoBack} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.dubbedTag}>
            <Text style={styles.dubbedTagText}>✅ Dubbed Video</Text>
          </View>
          <TouchableOpacity onPress={handleDelete} style={styles.headerBtn}>
            <Ionicons name="trash" size={22} color="#FF4D9D" />
          </TouchableOpacity>
        </View>

        {/* Play/Pause overlay */}
        <TouchableOpacity
          style={styles.playPauseOverlay}
          activeOpacity={0.9}
          onPress={handlePlayPause}
        >
          {!isPlaying && (
            <View style={styles.playBtnBig}>
              <Ionicons name="play" size={40} color="#fff" style={{ marginLeft: 4 }} />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Details section */}
      <ScrollView style={styles.detailsContainer} contentContainerStyle={styles.detailsContent}>
        {/* Language info */}
        <View style={styles.langRow}>
          <View style={styles.langChip}>
            <Text style={styles.langChipText}>🗣️ {videoData.fromLanguage}</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color="#9333EA" />
          <View style={[styles.langChip, styles.langChipTarget]}>
            <Text style={[styles.langChipText, { color: '#fff' }]}>🌐 {videoData.toLanguage}</Text>
          </View>
        </View>

        {/* Translated text */}
        {videoData.translatedText ? (
          <View style={styles.textCard}>
            <Text style={styles.textCardLabel}>Translated Text</Text>
            <Text style={styles.textCardContent}>{videoData.translatedText}</Text>
          </View>
        ) : null}

        {/* Date */}
        <Text style={styles.dateLabel}>
          Created: {new Date(videoData.createdAt).toLocaleString()}
        </Text>

        {/* Control buttons */}
        <View style={styles.controlRow}>
          <TouchableOpacity style={styles.controlBtn} onPress={handleReplay}>
            <Ionicons name="refresh" size={22} color="#9333EA" />
            <Text style={styles.controlBtnText}>Replay</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlBtn} onPress={handlePlayPause}>
            <Ionicons name={isPlaying ? "pause" : "play"} size={22} color="#9333EA" />
            <Text style={styles.controlBtnText}>{isPlaying ? 'Pause' : 'Play'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlBtn, styles.controlBtnPrimary]}
            onPress={async () => {
              await cleanupVideo();
              router.push('/home');
            }}
          >
            <Ionicons name="home" size={22} color="#fff" />
            <Text style={[styles.controlBtnText, { color: '#fff' }]}>Home</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5EDFF',
  },
  centerLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5EDFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#555',
    fontWeight: '500',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FF4D9D',
    fontWeight: '600',
  },
  backBtn: {
    marginTop: 20,
    backgroundColor: '#9333EA',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 16,
  },
  backBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  videoContainer: {
    height: height * 0.55,
    backgroundColor: '#000',
    position: 'relative',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  headerOverlay: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 100,
  },
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dubbedTag: {
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  dubbedTagText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  playPauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtnBig: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(147, 51, 234, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },
  detailsContainer: {
    flex: 1,
  },
  detailsContent: {
    padding: 20,
    paddingBottom: 40,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  langChip: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginHorizontal: 8,
  },
  langChipTarget: {
    backgroundColor: '#9333EA',
    borderColor: '#9333EA',
  },
  langChipText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  textCard: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 20,
    elevation: 3,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#22C55E',
  },
  textCardLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#22C55E',
    marginBottom: 8,
  },
  textCardContent: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  dateLabel: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  controlBtn: {
    flex: 0.3,
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  controlBtnPrimary: {
    backgroundColor: '#9333EA',
    borderColor: '#9333EA',
  },
  controlBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9333EA',
    marginTop: 4,
  },
});
