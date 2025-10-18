# Progressive Web App (PWA) Setup Guide

This guide explains how to install and use PC Remote Wake as a Progressive Web App on your mobile devices.

## Features

The PWA version provides:
- ✅ **Install on home screen** - Works like a native app
- ✅ **Offline support** - View cached data when offline
- ✅ **Fast loading** - Service worker caches assets
- ✅ **Standalone mode** - No browser UI, full-screen app experience
- ✅ **App shortcuts** - Quick actions from home screen
- ✅ **Auto-updates** - Automatically updates when new version available

## Installation Instructions

### iOS (iPhone/iPad)

1. **Open Safari** (must use Safari, not Chrome)
   - Navigate to your app URL (e.g., `http://192.168.1.100:3000`)

2. **Add to Home Screen**
   - Tap the Share button (square with arrow pointing up)
   - Scroll down and tap "Add to Home Screen"
   - Edit the name if desired (defaults to "PC Wake")
   - Tap "Add" in the top right

3. **Launch the App**
   - Find "PC Wake" on your home screen
   - Tap to open - it will launch in full-screen mode

### Android

1. **Open Chrome**
   - Navigate to your app URL (e.g., `http://192.168.1.100:3000`)

2. **Install Prompt**
   - You may see an install banner at the bottom - tap "Install"
   - Or tap the menu (⋮) → "Add to Home screen" or "Install app"

3. **Complete Installation**
   - Confirm the installation
   - The app icon will appear on your home screen

4. **Launch the App**
   - Tap the icon to open in standalone mode

## Using the PWA

### Standalone Mode
When launched from your home screen, the app runs in standalone mode:
- No browser address bar or navigation buttons
- Full-screen experience
- Native app-like navigation
- System gestures work as expected

### Offline Functionality
The PWA caches essential resources for offline use:
- **Cached**: Static assets, app shell, icons
- **Not Cached**: API calls require network connection
- **Offline Page**: Shown when trying to navigate while offline

### App Updates
The app automatically checks for updates:
- Updates download in the background
- Page reloads automatically when update is ready
- No manual update required

### Uninstalling
**iOS:**
- Long-press the app icon → "Remove App" → "Delete App"

**Android:**
- Long-press the app icon → "Uninstall" or drag to "Uninstall"

## Developer Notes

### Icon Generation

Icons are generated from the SVG source at `public/icon.svg`. To regenerate:

```bash
chmod +x scripts/generate-icons.sh
./scripts/generate-icons.sh
```

This creates:
- `icon-192.png` - Standard PWA icon
- `icon-512.png` - High-res PWA icon
- `apple-touch-icon.png` - iOS home screen icon (180x180)
- `favicon-32x32.png` - Browser favicon
- `favicon-16x16.png` - Browser favicon
- `favicon.ico` - Combined favicon file

### Service Worker

The service worker (`public/sw.js`) handles:
- **Cache-first strategy** for static assets
- **Network-first strategy** for page navigation
- **Network-only** for API calls (always fresh data)
- Offline fallback page

### Manifest File

The web app manifest (`public/manifest.json`) defines:
- App name and description
- Display mode (standalone)
- Theme colors
- Icons in various sizes
- App shortcuts

### Testing PWA Features

**Check PWA readiness:**
1. Open Chrome DevTools → Lighthouse
2. Run "Progressive Web App" audit
3. Fix any issues reported

**Test offline mode:**
1. Open Chrome DevTools → Network tab
2. Check "Offline" checkbox
3. Reload page - should show offline page
4. Navigate to cached pages - should work

**Test service worker:**
1. Open Chrome DevTools → Application tab
2. Check "Service Workers" section
3. Verify service worker is active
4. Test "Update on reload" and "Offline" checkboxes

### Production Deployment

**Important:** The service worker only registers in production mode.

For development testing:
```bash
npm run build
npm start
```

For Raspberry Pi deployment:
```bash
npm run build
# Service worker will be active when accessed from network
```

### Customization

**Change app colors:**
Edit `public/manifest.json`:
```json
{
  "theme_color": "#1e40af",
  "background_color": "#0f172a"
}
```

Also update in `app/layout.tsx`:
```typescript
themeColor: "#1e40af",
```

**Change app icon:**
1. Replace `public/icon.svg` with your design
2. Run `./scripts/generate-icons.sh` to regenerate PNGs

**Change app name:**
Edit `public/manifest.json`:
```json
{
  "name": "Your App Name",
  "short_name": "Short Name"
}
```

## Troubleshooting

### "Add to Home Screen" not showing (iOS)
- ✅ Must use Safari (not Chrome or other browsers)
- ✅ Must be on HTTPS or localhost (for testing)
- ✅ Check that manifest.json is loading (DevTools → Network)

### Service worker not registering
- ✅ Service worker only works in production (`npm run build && npm start`)
- ✅ Check browser console for errors
- ✅ Verify `public/sw.js` is accessible at `/sw.js`

### Offline page not showing
- ✅ Service worker must be active
- ✅ Check Application → Cache Storage in DevTools
- ✅ Verify `offline.html` is cached

### App not updating
- ✅ Clear browser cache and service worker
- ✅ In DevTools → Application → Service Workers → "Unregister"
- ✅ Hard reload (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)

### Icons not showing correctly
- ✅ Regenerate icons: `./scripts/generate-icons.sh`
- ✅ Clear cache and reload
- ✅ Check that PNG files exist in `public/` directory
- ✅ Verify manifest.json paths are correct

## Resources

- [Progressive Web Apps (MDN)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Service Workers (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest (MDN)](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [iOS Web App Meta Tags](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)
