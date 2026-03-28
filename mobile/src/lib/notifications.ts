import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import api from './api';

let Notifications: any = null;

// Only load and initialize expo-notifications if we are NOT in Expo Go
if (Constants.appOwnership !== 'expo') {
  try {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (e) {
    console.log("Failed to initialize expo-notifications", e);
  }
}

export async function registerForPushNotificationsAsync() {
  let token;

  // IMPORTANT: SDK 53 removed Android push notification from Expo Go
  // We must skip registration entirely to prevent app crashes when run in Expo Go
  if (!Notifications) {
    console.log('Push notifications registration is skipped (Not supported in this environment)');
    return null;
  }

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance?.MAX || 5, // fallback 5
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#D4AF37',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return;
      }
      
      // projectId is retrieved from Constants.expoConfig automatically in SDK 50+
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
      
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      
      // Optionally send the token to your backend immediately
      if (token) {
         try {
           await api.post('/api/mobile/push-token', { token, deviceOs: Platform.OS });
         } catch (err) {
           console.log('Gagal menyimpan Push Token ke backend:', err);
         }
      }
    } else {
      // Simulator/Emulator doesn't support Push Notifications generally.
    }
  } catch (error) {
     console.log('Error getting push token. Safely ignoring.', error);
  }

  return token;
}
