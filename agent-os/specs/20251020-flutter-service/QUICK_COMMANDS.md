# Flutter Research Spike - Quick Command Reference

## Installation Status ✅

All automated setup complete. Run these to verify:

```bash
# Check Flutter
flutter --version
# Should show: Flutter 3.35.6

# Check Appium
appium --version
# Should show: 3.1.0

# Check Driver
appium driver list --installed
# Should show: flutter-integration@2.0.3

# Check Android Studio
ls -la "/Applications/Android Studio.app"
# Should exist
```

---

## Manual Setup Checklist

Run after Android Studio configuration:

```bash
# 1. Accept Flutter licenses
flutter doctor --android-licenses

# 2. Verify setup
flutter doctor

# 3. Check for emulator
emulator -list-avds

# 4. Start emulator (replace <name> with your AVD name)
emulator -avd <name> &

# 5. Wait for emulator to boot, then check device
flutter devices
```

---

## Day 2 Commands (Once Setup Complete)

```bash
# Create test app
cd /tmp
flutter create flutter_test_app
cd flutter_test_app

# Add integration_test to pubspec.yaml (manual edit)

# Build Android
flutter build apk --debug

# Find APK location
ls -la build/app/outputs/flutter-apk/app-debug.apk

# Build macOS (if Xcode installed)
flutter build macos --debug

# Find .app location
ls -la build/macos/Build/Products/Debug/flutter_test_app.app
```

---

## Start Appium Server

```bash
# Terminal 1: Start Appium
appium --use-drivers=flutter-integration

# Should see:
# [Appium] Welcome to Appium v3.1.0
# [Appium] Available drivers:
#   - flutter-integration@2.0.3
```

---

## Troubleshooting

```bash
# If flutter command not found
export PATH="$PATH:/opt/homebrew/bin/flutter/bin"

# If appium command not found
which appium
# Should show: /Users/sam/.nvm/versions/node/v22.17.0/bin/global/5/bin/appium

# Flutter doctor verbose
flutter doctor -v

# List installed Appium drivers
appium driver list

# Appium server info
appium server --show-config
```

---

## Android Emulator Quick Start

```bash
# List available emulators
emulator -list-avds

# Start emulator in background
emulator -avd <emulator_name> &

# Check if emulator is ready
adb devices

# When ready, you'll see:
# List of devices attached
# emulator-5554   device
```

---

## Useful Paths

| Item | Path |
|------|------|
| Android Studio | `/Applications/Android Studio.app` |
| Flutter SDK | `/opt/homebrew/share/flutter` |
| Android SDK | `~/Library/Android/sdk` (after setup) |
| Appium | `/Users/sam/.nvm/versions/node/v22.17.0/bin/global/5` |

---

## Research Spike Files

| File | Purpose |
|------|---------|
| `DAY_1_SUMMARY.md` | Today's progress and next steps |
| `RESEARCH_SPIKE_PLAN.md` | Full 5-day plan with details |
| `RESEARCH.md` | Running log of all findings |
| `CRITICAL_BLOCKER.md` | Analysis of Flutter Driver deprecation |
| `MVP_SPEC.md` | Proposed MVP scope (if GO) |
| `QUICK_COMMANDS.md` | This file |

---

## When Ready for Day 2

Let me know when Android Studio setup is complete, and I'll:
1. Create Flutter test app
2. Add integration_test
3. Build for Android (and macOS if Xcode ready)
4. Verify builds succeed

This completes Day 1! 🎉

