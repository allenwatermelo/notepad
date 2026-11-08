# Little Bloom

Little Bloom is a React + Vite app packaged for iOS with Capacitor. The iOS project contains the compiled web app, so its core screens and data do not rely on a hosted website or an internet connection. Notes, tasks, events, categories, and preferences are stored locally in IndexedDB inside the app's WebView.

## Build and install on iPhone

iOS builds require a Mac with Xcode. Capacitor 8 currently requires Xcode 26 and supports iOS 15 and later. A Windows machine can edit the project and scaffold the iOS files, but it cannot compile, sign, or install the iOS app.

On the Mac:

1. Install Node.js 22 or later and Xcode 26, then install Xcode Command Line Tools.
2. Open this project on the Mac and run `npm install`.
3. Run `npm run ios:sync` to build the React app and copy the local bundle into the iOS project.
4. Run `npm run ios:open` to open the project in Xcode.
5. In Xcode, choose the App target, select a signing team, connect the iPhone 11, select it as the run destination, and press Run.

The configured bundle ID is `com.littlebloom.app`; change it in `capacitor.config.ts` and Xcode if you need a unique identifier. A personal Apple Account can install a development build on a personal device through Xcode, but Apple requires periodic reprovisioning; TestFlight or App Store distribution requires Apple Developer Program membership. See [Apple's developer account guidance](https://developer.apple.com/help/account/basics/about-your-developer-account/).

The iOS native project is in `ios/`. Its app icon and splash screen are in `ios/App/App/Assets.xcassets`; their source artwork is in `assets/`. Replace the asset-catalog images when updating the artwork, then run `npm run ios:sync`.

## Local data and offline use

The native build does not register the PWA service worker; Capacitor loads the built files bundled in the app. Fonts are bundled locally as well. All current app features use local browser APIs and IndexedDB. iOS stores this database separately from Safari, so Safari PWA data is not automatically transferred; use More → Export backup in the old copy and More → Restore backup in the installed app if needed.

The web PWA configuration remains available for hosting and browser installation.
