import axios from 'axios';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { BASE_URL } from '@/services/api';
import { getUserSession, setUserSession, clearUserSession } from '@/services/storage';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');

export default function Index() {

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [showOTP, setShowOTP] = useState(false);

  const router = useRouter();

  // ANIMATION
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(80)).current;

  useEffect(() => {
    const checkSession = async () => {
      const savedEmail = await getUserSession();
      if (savedEmail) {
        try {
          const res = await axios.post(`${BASE_URL}/check-user`, { email: savedEmail });
          if (res.data.exists) {
            router.replace('/home');
          } else {
            await clearUserSession();
          }
        } catch (err) {
          console.error("Session verification error:", err);
        }
      }
    };
    checkSession();

    Animated.parallel([

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),

      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1200,
        useNativeDriver: true,
      }),

    ]).start();

  }, []);

  // EMAIL VALIDATION
  const isValidEmail = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;

  // SEND OTP
  const handleSendOTP = async () => {

    if (!isValidEmail.test(email)) {
      alert("Invalid Email ❌");
      return;
    }

    try {

      await axios.post(`${BASE_URL}/send-otp`, { email });

      alert("OTP Sent 📩");

      setShowOTP(true);

    } catch (err) {

      console.log(err);

      alert("Error sending OTP ❌");

    }
  };

  // VERIFY OTP
  const handleVerifyOTP = async () => {

    try {

      const res = await axios.post(`${BASE_URL}/verify-otp`, {
        email,
        otp,
      });

      if (res.data.success) {

        const userCheck = await axios.post(`${BASE_URL}/check-user`, {
          email,
        });

        if (userCheck.data.exists) {

          alert("Welcome Back 😄");

          await setUserSession(email);

          router.replace('/home');

        } else {

          alert("Complete Profile 👋");

          router.push({
            pathname: "/profile",
            params: { email: email },
          });

        }

      } else {

        alert("Invalid OTP ❌");

      }

    } catch (err) {

      console.log(err);

      alert("Error ❌");

    }
  };

  return (

    <View style={styles.container}>

      {/* BACKGROUND BLOBS */}
      <View style={styles.circle1} />
      <View style={styles.circle2} />
      <View style={styles.circle3} />

      <Animated.View
        style={[
          styles.card,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >

        {/* APP NAME */}
        <Text style={styles.logo}>
          Vocalize AI 🎙️
        </Text>

        <Text style={styles.tagline}>
          Translate • Dub • Connect
        </Text>

        <Text style={styles.heading}>
          AI Video Language Translation ✨
        </Text>

        {/* EMAIL */}
        <TextInput
          placeholder="Enter Gmail"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          autoCapitalize="none"
        />

        {/* SEND OTP */}
        {!showOTP && (

          <TouchableOpacity
            style={styles.button}
            onPress={handleSendOTP}
          >

            <Text style={styles.buttonText}>
              Continue →
            </Text>

          </TouchableOpacity>

        )}

        {/* OTP */}
        {showOTP && (

          <>

            <TextInput
              placeholder="Enter OTP"
              placeholderTextColor="#888"
              value={otp}
              onChangeText={setOtp}
              style={styles.input}
              keyboardType="numeric"
            />

            <TouchableOpacity
              style={styles.button}
              onPress={handleVerifyOTP}
            >

              <Text style={styles.buttonText}>
                Verify OTP ✔
              </Text>

            </TouchableOpacity>

          </>

        )}

      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5EDFF',
  },

  // BACKGROUND
  circle1: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 200,
    backgroundColor: '#C084FC',
    top: -60,
    left: -60,
    opacity: 0.4,
  },

  circle2: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 200,
    backgroundColor: '#9333EA',
    bottom: -100,
    right: -80,
    opacity: 0.25,
  },

  circle3: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 200,
    backgroundColor: '#FF4D9D',
    top: 180,
    right: -40,
    opacity: 0.25,
  },

  // CARD
  card: {
    width: width * 0.88,
    backgroundColor: 'rgba(255,255,255,0.88)',
    padding: 28,
    borderRadius: 35,
    elevation: 12,
  },

  logo: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#9333EA',
    textAlign: 'center',
  },

  tagline: {
    textAlign: 'center',
    color: '#777',
    marginTop: 8,
    marginBottom: 20,
    fontSize: 15,
  },

  heading: {
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '600',
    color: '#222',
    marginBottom: 30,
  },

  input: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 18,
    marginBottom: 18,
    fontSize: 16,
    elevation: 4,
  },

  button: {
    backgroundColor: '#9333EA',
    padding: 18,
    borderRadius: 18,
    elevation: 6,
  },

  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 17,
  },

});