import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';
import api from './api';

// Default behavior for incoming notifications when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
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
    
    try {
      // You can pass your Expo project ID here if you migrate to EAS Build:
      // projectId: 'your-project-id'
      token = (await Notifications.getExpoPushTokenAsync()).data;
      
      // Optionally send the token to your backend immediately
      if (token) {
         try {
           await api.post('/api/mobile/push-token', { token, deviceOs: Platform.OS });
         } catch (err) {
           console.log('Gagal menyimpan Push Token ke backend:', err);
         }
      }
    } catch (error) {
       console.log('Error getting push token', error);
    }
  } else {
    // Simulator/Emulator doesn't support Push Notifications generally.
    // console.log('Must use physical device for Push Notifications');
  }

  return token;
}
