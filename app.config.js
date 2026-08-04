// app.config.js — dynamic Expo config
// Reads API_BASE_URL from the environment at build/run time so the
// production server address is never committed to source control.
//
// Set it in a local .env file (gitignored) or as an EAS secret:
//   echo "API_BASE_URL=https://your-server.example.com:3001/api" > .env
//   # or: eas secret:create --scope project --name API_BASE_URL --value "https://..."

import 'dotenv/config';

export default {
  expo: {
    name: 'AssetPulse Monitor',
    slug: 'assetpulse-monitor',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#080d17',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.assetpulse.monitor',
      infoPlist: {
        NSCameraUsageDescription:
          'AssetPulse uses the camera to scan asset QR / barcodes and capture device photos.',
        NSFaceIDUsageDescription:
          'AssetPulse uses FaceID to unlock the app when biometric protection is enabled.',
        NSLocationWhenInUseUsageDescription:
          'AssetPulse uses your location to show local weather on the dashboard.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0f172a',
      },
      package: 'com.assetpulse.monitor',
      permissions: [
        'CAMERA',
        'USE_BIOMETRIC',
        'USE_FINGERPRINT',
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
      ],
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
    },
    scheme: 'assetpulse',
    plugins: [
      'expo-asset',
      'expo-font',
      'expo-secure-store',
      [
        'expo-notifications',
        {
          icon:            './assets/icon.png',
          color:           '#3b82f6',
          defaultChannel:  'alerts',
          sounds:          [],
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission:
            'Allow AssetPulse to use the camera for QR / barcode scanning and asset photos.',
        },
      ],
      [
        'expo-local-authentication',
        {
          faceIDPermission:
            'Use FaceID to unlock the AssetPulse app when biometric protection is enabled.',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            'Allow AssetPulse to access your photos when attaching pictures to assets.',
          cameraPermission:
            'Allow AssetPulse to use the camera to capture asset photos.',
        },
      ],
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'Allow AssetPulse to use your location to show local weather on the dashboard.',
          isAndroidBackgroundLocationEnabled: false,
        },
      ],
    ],
    extra: {
      // Server URL is now entered by the user at runtime (not baked in at build time).
      // Kept here as an optional override for enterprise/kiosk builds that want to
      // pre-configure a specific server.
      apiBaseUrl: process.env.API_BASE_URL || null,
      eas: {
        projectId: '1ad659a2-077f-4c60-8dca-e14e999e0d8e',
      },
    },
  },
};
