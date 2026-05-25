import React from 'react';

import {
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';

import { useRouter } from 'expo-router';


export default function Footer() {

  const router =
  useRouter();

  return (

    <View style={styles.footer}>

      {/* HOME */}
      <TouchableOpacity
      onPress={() =>
      router.push('/home')}>

        <Ionicons
          name="home"
          size={30}
          color="white"
        />

      </TouchableOpacity>


      {/* UPLOAD */}
      <TouchableOpacity
      style={styles.addButton}
      onPress={() =>
      router.push('/upload' as any)}>

        <Ionicons
          name="add"
          size={38}
          color="white"
        />

      </TouchableOpacity>


      {/* PROFILE */}
      <TouchableOpacity
      onPress={() =>
      router.push('/userprofile' as any)}>

        <Ionicons
          name="person"
          size={30}
          color="white"
        />

      </TouchableOpacity>

    </View>

  );

}


const styles =
StyleSheet.create({

  footer: {

    position: 'absolute',

    bottom: 20,

    left: 20,

    right: 20,

    height: 70,

    backgroundColor:
    '#111',

    borderRadius: 40,

    flexDirection: 'row',

    justifyContent:
    'space-around',

    alignItems: 'center',

    paddingHorizontal: 20,

  },

  addButton: {

    width: 65,

    height: 65,

    borderRadius: 35,

    backgroundColor:
    '#a020f0',

    justifyContent:
    'center',

    alignItems: 'center',

    marginBottom: 30,

  },

});