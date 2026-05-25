import axios from 'axios';
import {
  useLocalSearchParams,
  useRouter
} from 'expo-router';
import { BASE_URL } from '@/services/api';
import { setUserSession } from '@/services/storage';

import React, {
  useEffect,
  useRef,
  useState
} from 'react';

import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';


const { width } =
Dimensions.get('window');


export default function Profile() {

  const router =
  useRouter();

  const { email } =
  useLocalSearchParams();


  const [name,
  setName] = useState('');

  const [age,
  setAge] = useState('');

  const [gender,
  setGender] = useState('');

  const [languages,
  setLanguages] = useState<string[]>([]);

  const [isEditing, setIsEditing] = useState(false);


  // ANIMATION
  const fadeAnim =
  useRef(
    new Animated.Value(0)
  ).current;

  const slideAnim =
  useRef(
    new Animated.Value(80)
  ).current;


  useEffect(() => {
    const fetchExistingProfile = async () => {
      if (!email) return;
      try {
        const response = await axios.post(`${BASE_URL}/check-user`, { email });
        if (response.data.exists && response.data.user) {
          const u = response.data.user;
          setName(u.name || '');
          setAge(u.age ? u.age.toString() : '');
          setGender(u.gender || '');
          setLanguages(u.languages || []);
          setIsEditing(true);
        }
      } catch (err) {
        console.error('Error fetching profile for edit:', err);
      }
    };
    fetchExistingProfile();

    Animated.parallel([

      Animated.timing(
        fadeAnim,
        {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }
      ),

      Animated.timing(
        slideAnim,
        {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }
      ),

    ]).start();

  }, [email]);


  // LANGUAGE SELECT
  const toggleLanguage =
  (lang: string) => {

    if (
      languages.includes(lang)
    ) {

      setLanguages(

        languages.filter(
          (item) =>
          item !== lang
        )

      );

    } else {

      setLanguages([
        ...languages,
        lang
      ]);

    }

  };


  // SAVE PROFILE
  const handleSave =
  async () => {

    if (

      !name ||
      !age ||
      !gender ||
      languages.length === 0

    ) {

      alert(
        "Fill all fields ❌"
      );

      return;

    }


    if (
      name.length > 20
    ) {

      alert(
       "Name max 20 letters ❌"
      );

      return;

    }


    if (
      parseInt(age) > 60
    ) {

      alert(
       "Age must be <= 60 ❌"
      );

      return;

    }


    try {
      // SAVE PROFILE
      const response =
      await axios.post(

        `${BASE_URL}/save-profile`,

        {

          email,
          name,
          age,
          gender,
          languages,

        }

      );


      if (
        response.data.success
      ) {

        alert(
         isEditing ? "Profile Updated ✅" : "Profile Saved ✅"
        );

        if (email) {
          await setUserSession(email as string);
        }

        router.replace('/home');

      } else {

        alert(
         "Profile save failed ❌"
        );

      }

    } catch (err) {

      console.log(err);

      alert(
       "Error saving ❌"
      );

    }

  };


  return (

    <View style={styles.container}>


      {/* BACKGROUND */}
      <View style={styles.circle1} />

      <View style={styles.circle2} />

      <View style={styles.circle3} />


      <Animated.View

        style={[

          styles.card,

          {
            opacity: fadeAnim,

            transform: [
              {
                translateY:
                slideAnim
              }
            ],

          }

        ]}

      >


        {/* TITLE */}
        <Text style={styles.logo}>
          Vocalize AI 🎙️
        </Text>

        <Text style={styles.subtitle}>
          {isEditing ? "Update Your Profile ✏️" : "Complete Your Profile ✨"}
        </Text>


        {/* NAME */}
        <TextInput

          placeholder="Enter Name"

          placeholderTextColor="#888"

          value={name}

          onChangeText={setName}

          style={styles.input}

        />


        {/* AGE */}
        <TextInput

          placeholder="Enter Age"

          placeholderTextColor="#888"

          value={age}

          onChangeText={setAge}

          style={styles.input}

          keyboardType="numeric"

        />


        {/* GENDER */}
        <Text style={styles.label}>
          Select Gender
        </Text>


        <View style={styles.row}>


          <TouchableOpacity

            style={[

              styles.option,

              gender === 'Male'
              && styles.selected

            ]}

            onPress={() =>
            setGender('Male')}

          >

            <Text style={styles.optionText}>
              👦 Male
            </Text>

          </TouchableOpacity>


          <TouchableOpacity

            style={[

              styles.option,

              gender === 'Female'
              && styles.selected

            ]}

            onPress={() =>
            setGender('Female')}

          >

            <Text style={styles.optionText}>
              👧 Female
            </Text>

          </TouchableOpacity>

        </View>


        {/* LANGUAGES */}
        <Text style={styles.label}>
          Select Languages 🌍
        </Text>


        <View style={styles.languageWrap}>


          {[
            'English',
            'Hindi',
            'Kannada',
            'Korean',
          ].map((lang) => (


            <TouchableOpacity

              key={lang}

              style={[

                styles.langChip,

                languages.includes(lang)
                && styles.selectedChip,

              ]}

              onPress={() =>
              toggleLanguage(lang)}

            >

              <Text style={styles.langText}>
                {lang}
              </Text>

            </TouchableOpacity>

          ))}

        </View>


        {/* BUTTON */}
        <TouchableOpacity

          style={styles.button}

          onPress={handleSave}

        >

          <Text style={styles.buttonText}>
            {isEditing ? "Update Profile 🚀" : "Save Profile 🚀"}
          </Text>

        </TouchableOpacity>

      </Animated.View>

    </View>

  );

}


const styles =
StyleSheet.create({

  container: {

    flex: 1,

    justifyContent:
    'center',

    alignItems:
    'center',

    backgroundColor:
    '#F5EDFF',

  },


  // BACKGROUND
  circle1: {

    position: 'absolute',

    width: 250,

    height: 250,

    borderRadius: 200,

    backgroundColor:
    '#C084FC',

    top: -60,

    left: -60,

    opacity: 0.4,

  },


  circle2: {

    position: 'absolute',

    width: 300,

    height: 300,

    borderRadius: 200,

    backgroundColor:
    '#9333EA',

    bottom: -100,

    right: -80,

    opacity: 0.25,

  },


  circle3: {

    position: 'absolute',

    width: 180,

    height: 180,

    borderRadius: 200,

    backgroundColor:
    '#FF4D9D',

    top: 180,

    right: -40,

    opacity: 0.25,

  },


  // CARD
  card: {

    width: width * 0.9,

    backgroundColor:
    'rgba(255,255,255,0.88)',

    padding: 28,

    borderRadius: 35,

    elevation: 12,

  },


  logo: {

    fontSize: 34,

    fontWeight: 'bold',

    color: '#9333EA',

    textAlign: 'center',

  },


  subtitle: {

    textAlign: 'center',

    color: '#555',

    marginTop: 10,

    marginBottom: 30,

    fontSize: 18,

  },


  input: {

    backgroundColor: '#fff',

    padding: 18,

    borderRadius: 18,

    marginBottom: 18,

    fontSize: 16,

    elevation: 4,

  },


  label: {

    fontSize: 16,

    fontWeight: '600',

    color: '#333',

    marginBottom: 10,

    marginTop: 10,

  },


  row: {

    flexDirection: 'row',

    justifyContent:
    'space-between',

    marginBottom: 20,

  },


  option: {

    backgroundColor:
    '#ECECEC',

    padding: 15,

    borderRadius: 18,

    width: '47%',

    alignItems: 'center',

  },


  selected: {

    backgroundColor:
    '#C084FC',

  },


  optionText: {

    fontWeight: '600',

    color: '#222',

  },


  languageWrap: {

    flexDirection: 'row',

    flexWrap: 'wrap',

    justifyContent:
    'space-between',

    marginBottom: 20,

  },


  langChip: {

    backgroundColor:
    '#ECECEC',

    width: '47%',

    paddingVertical: 18,

    borderRadius: 18,

    marginBottom: 15,

    alignItems: 'center',

  },


  selectedChip: {

    backgroundColor:
    '#C084FC',

  },


  langText: {

    fontWeight: '600',

    color: '#222',

  },


  button: {

    backgroundColor:
    '#9333EA',

    padding: 18,

    borderRadius: 18,

    elevation: 6,

    marginTop: 10,

  },


  buttonText: {

    color: '#fff',

    textAlign: 'center',

    fontWeight: 'bold',

    fontSize: 17,

  },

});