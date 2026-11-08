import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.littlebloom.app',
  appName: 'Little Bloom',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      launchAutoHide: true,
      backgroundColor: '#FFF9F5',
      showSpinner: false,
    },
  },
}

export default config
