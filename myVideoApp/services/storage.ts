import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_EMAIL_KEY = 'user_email_session';

export const setUserSession = async (email: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(USER_EMAIL_KEY, email.trim().toLowerCase());
  } catch (error) {
    console.error('Error saving user session:', error);
  }
};

export const getUserSession = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(USER_EMAIL_KEY);
  } catch (error) {
    console.error('Error getting user session:', error);
    return null;
  }
};

export const clearUserSession = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(USER_EMAIL_KEY);
  } catch (error) {
    console.error('Error clearing user session:', error);
  }
};
