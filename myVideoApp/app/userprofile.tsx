import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { BASE_URL } from '@/services/api';
import { getUserSession, clearUserSession } from '@/services/storage';
import Footer from '@/components/Footer';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width } = Dimensions.get('window');

interface UserProfile {
  name: string;
  email: string;
  age: number;
  gender: string;
  languages: string[];
  videosCount: number;
  translatedCount: number;
  likesCount: number;
}

export default function UserProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile>({
    name: 'Vocalize User',
    email: '',
    age: 0,
    gender: 'Other',
    languages: [],
    videosCount: 0,
    translatedCount: 0,
    likesCount: 0,
  });

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      const email = await getUserSession();
      if (!email) {
        router.replace('/');
        return;
      }

      // Fetch User Details
      const userCheck = await axios.post(`${BASE_URL}/check-user`, { email });
      
      if (userCheck.data.exists && userCheck.data.user) {
        const u = userCheck.data.user;
        
        // Fetch User's videos to calculate metrics
        const videosRes = await axios.get(`${BASE_URL}/api/videos`, {
          params: { email: email },
        });
        const userVideos = videosRes.data || [];
        const totalLikes = userVideos.reduce((sum: number, v: any) => sum + (v.likes || 0), 0);

        // Fetch real translated video count from database
        let translatedCount = 0;
        try {
          const translatedRes = await axios.get(`${BASE_URL}/api/translated-videos`, {
            params: { email: email },
          });
          translatedCount = (translatedRes.data || []).length;
        } catch (tErr) {
          console.log('Error fetching translated count:', tErr);
        }

        setUser({
          name: u.name || 'Vocalize User',
          email: u.email || email,
          age: u.age || 20,
          gender: u.gender || 'Male',
          languages: u.languages || [],
          videosCount: userVideos.length,
          translatedCount: translatedCount,
          likesCount: totalLikes,
        });
      } else {
        // No profile found, route to profile setup
        router.push({
          pathname: '/profile',
          params: { email: email }
        });
      }
    } catch (err) {
      console.log('Error loading user profile dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await clearUserSession();
    alert("Signed out successfully 👋");
    router.replace('/');
  };

  if (loading) {
    return (
      <View style={styles.centerLoader}>
        <ActivityIndicator size="large" color="#9333EA" />
        <Text style={styles.loaderText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.outerContainer}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* BACKGROUND GRAPHICS */}
        <View style={styles.circle1} />
        <View style={styles.circle2} />
        <View style={styles.circle3} />

        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Profile 👤</Text>
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutIcon}>
            <Ionicons name="log-out-outline" size={24} color="#FF4D9D" />
          </TouchableOpacity>
        </View>

        {/* AVATAR & NAME */}
        <View style={styles.avatarCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>
              {user.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>

        {/* STATS OVERVIEW */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{user.videosCount}</Text>
            <Text style={styles.statLabel}>Videos</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{user.translatedCount}</Text>
            <Text style={styles.statLabel}>Translated</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{user.likesCount}</Text>
            <Text style={styles.statLabel}>Likes</Text>
          </View>
        </View>

        {/* DETAILS CARD */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Personal Details</Text>
          
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={20} color="#9333EA" style={{ width: 24 }} />
            <Text style={styles.detailText}>Age: {user.age} years old</Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="transgender-outline" size={20} color="#9333EA" style={{ width: 24 }} />
            <Text style={styles.detailText}>Gender: {user.gender}</Text>
          </View>

          <Text style={styles.sectionTitle}>Subscribed Languages</Text>
          <View style={styles.languageWrap}>
            {user.languages.length > 0 ? (
              user.languages.map((lang) => (
                <View key={lang} style={styles.langChip}>
                  <Text style={styles.langText}>{lang}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noLangsText}>No languages selected yet.</Text>
            )}
          </View>

          <TouchableOpacity 
            style={styles.editButton} 
            onPress={() => router.push({
              pathname: '/profile',
              params: { email: user.email }
            })}
          >
            <Text style={styles.editButtonText}>Edit Profile Details</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* BOTTOM TAB FOOTER */}
      <Footer />
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
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 110,
  },
  circle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#C084FC',
    top: -50,
    right: -40,
    opacity: 0.4,
  },
  circle2: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#FF4D9D',
    bottom: -60,
    left: -50,
    opacity: 0.25,
  },
  circle3: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#9333EA',
    top: 250,
    left: -30,
    opacity: 0.2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: width * 0.9,
    marginBottom: 20,
  },
  backButton: {
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 20,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#9333EA',
  },
  signOutIcon: {
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 20,
    elevation: 2,
  },
  avatarCard: {
    alignItems: 'center',
    marginVertical: 15,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#9333EA',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 44,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
    marginTop: 10,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: width * 0.9,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    paddingVertical: 15,
    marginVertical: 15,
    elevation: 4,
  },
  statBox: {
    alignItems: 'center',
    width: '30%',
  },
  statNum: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#9333EA',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  card: {
    width: width * 0.9,
    backgroundColor: 'rgba(255,255,255,0.88)',
    padding: 24,
    borderRadius: 30,
    elevation: 8,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 14,
    marginTop: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 15,
    color: '#444',
    marginLeft: 10,
  },
  languageWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 10,
  },
  langChip: {
    backgroundColor: '#C084FC',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
  },
  langText: {
    color: '#fff',
    fontWeight: '600',
  },
  noLangsText: {
    color: '#777',
    fontStyle: 'italic',
  },
  editButton: {
    borderWidth: 2,
    borderColor: '#9333EA',
    padding: 14,
    borderRadius: 18,
    marginTop: 20,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#9333EA',
    fontWeight: 'bold',
    fontSize: 15,
  },
  centerLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5EDFF',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 15,
    color: '#555',
    fontWeight: '500',
  },
});
