# Flutter Service - Research Spike Execution Plan

**Duration:** 1 Week (5 days)
**Goal:** Validate `appium-flutter-integration-driver` works with WebDriverIO
**Decision:** GO/NO-GO by end of week

## Prerequisites

### Required Software
- [ ] Flutter SDK (latest stable with Flutter 3.19+)
- [ ] Appium (latest 2.x)
- [ ] appium-flutter-integration-driver
- [ ] Android SDK + Android Studio (for emulator)
- [ ] Xcode (already on macOS)
- [ ] Node.js (already installed)

### Installation Steps

#### 1. Install Flutter SDK
```bash
# Using Homebrew
brew install --cask flutter

# Verify installation
flutter doctor
flutter --version

# Should be 3.19+ or later
```

#### 2. Install Appium
```bash
# Install Appium CLI globally
npm install -g appium

# Verify installation
appium --version

# Should be 2.x
```

#### 3. Install appium-flutter-integration-driver
```bash
# Install the new integration driver
appium driver install --source=npm appium-flutter-integration-driver

# List installed drivers
appium driver list --installed
```

#### 4. Install Android SDK (if not present)
```bash
# Install Android Studio via Homebrew
brew install --cask android-studio

# Or download from: https://developer.android.com/studio

# After installation, open Android Studio:
# - Install Android SDK
# - Install Android Emulator
# - Create a virtual device (Pixel 6, Android 13+)
```

## Day 1: Environment Setup & Validation

### Tasks
- [ ] Install Flutter SDK
- [ ] Run `flutter doctor` and fix any issues
- [ ] Install Appium
- [ ] Install appium-flutter-integration-driver
- [ ] Verify driver is installed correctly
- [ ] Install/update Android SDK
- [ ] Create Android emulator (Pixel 6, Android 13)
- [ ] Document installation steps and issues

### Success Criteria
- ✅ Flutter SDK installed and working
- ✅ Appium 2.x installed
- ✅ flutter-integration-driver installed
- ✅ Android emulator created and boots successfully

### Estimated Time
4-6 hours (includes troubleshooting)

---

## Day 2: Create Flutter Test App

### Tasks
- [ ] Create new Flutter app
  ```bash
  flutter create flutter_test_app
  cd flutter_test_app
  ```
- [ ] Add `integration_test` to pubspec.yaml
  ```yaml
  dev_dependencies:
    integration_test:
      sdk: flutter
    flutter_test:
      sdk: flutter
  ```
- [ ] Create simple counter app (use default template)
- [ ] Add test IDs/keys to widgets for finding elements
- [ ] Build Android APK (debug mode)
  ```bash
  flutter build apk --debug
  ```
- [ ] Build macOS app (debug mode)
  ```bash
  flutter build macos --debug
  ```
- [ ] Verify builds complete successfully
- [ ] Document build output locations

### Success Criteria
- ✅ Flutter app created with integration_test
- ✅ Android APK builds successfully
- ✅ macOS .app builds successfully
- ✅ Widgets have test keys for element finding

### Estimated Time
2-3 hours

---

## Day 3: Manual Appium Testing

### Tasks
- [ ] Start Appium server
  ```bash
  appium --use-drivers=flutter-integration
  ```
- [ ] Start Android emulator
  ```bash
  # List available emulators
  emulator -list-avds

  # Start emulator
  emulator -avd <emulator_name>
  ```
- [ ] Test Android app manually with Appium Inspector
  - Connect to localhost:4723
  - Configure Flutter capabilities
  - Verify can see widgets
  - Test byValueKey command
  - Test tap command

- [ ] Test macOS app manually with Appium Inspector
  - Connect to localhost:4723
  - Configure Flutter capabilities for macOS
  - Verify can see widgets
  - Test basic commands

- [ ] Document working capabilities for both platforms
- [ ] Document any issues or limitations found

### Success Criteria
- ✅ Appium server starts with flutter-integration driver
- ✅ Can connect to Android app
- ✅ Can connect to macOS app
- ✅ Basic commands work (find, tap)
- ✅ Capabilities documented

### Estimated Time
4-5 hours (includes troubleshooting)

---

## Day 4: WebDriverIO Integration

### Tasks
- [ ] Create minimal WebDriverIO config
  ```javascript
  // wdio.conf.js
  export const config = {
    hostname: 'localhost',
    port: 4723,
    path: '/',
    capabilities: [{
      platformName: 'Android',
      'appium:automationName': 'FlutterIntegration',
      'appium:app': '/path/to/app-debug.apk',
      // ... other caps
    }],
    // ... rest of config
  };
  ```

- [ ] Create simple test file
  ```javascript
  describe('Flutter Counter App', () => {
    it('should increment counter', async () => {
      // Find by value key
      const incrementBtn = await $('~increment');
      await incrementBtn.click();

      // Verify counter increased
      const counter = await $('~counter');
      const text = await counter.getText();
      expect(text).toBe('1');
    });
  });
  ```

- [ ] Test on Android
  ```bash
  npx wdio wdio.conf.android.js
  ```

- [ ] Test on macOS
  ```bash
  npx wdio wdio.conf.macos.js
  ```

- [ ] Document working configuration
- [ ] Document command syntax differences from Electron
- [ ] Test additional commands:
  - byType
  - byText
  - enterText
  - scroll
  - waitFor

### Success Criteria
- ✅ WebDriverIO connects to Appium
- ✅ Tests run on Android
- ✅ Tests run on macOS
- ✅ Core commands work (find, tap, enterText)
- ✅ Configuration documented

### Estimated Time
4-6 hours

---

## Day 5: Assessment & Documentation

### Tasks
- [ ] Review all findings
- [ ] Identify blockers or limitations
- [ ] Check GitHub issues for known problems:
  - https://github.com/appium/appium-flutter-integration-driver/issues
- [ ] Document setup complexity (vs Electron)
- [ ] Document command differences
- [ ] Estimate learning curve for users
- [ ] Create comparison table:
  | Aspect | Electron Service | Flutter Service |
  |--------|------------------|-----------------|
  | Setup | ... | ... |
  | Commands | ... | ... |
  | Platforms | ... | ... |

- [ ] Write GO/NO-GO recommendation
- [ ] Document timeline estimate if GO
- [ ] Create revised MVP spec if GO

### GO Criteria
- ✅ Driver works on both platforms
- ✅ Basic commands functional
- ✅ Setup is reasonable (< 30 min)
- ✅ No critical blocking bugs
- ✅ Documentation exists

### NO-GO Criteria
- ❌ Driver doesn't work on a platform
- ❌ Critical commands don't work
- ❌ Setup is too complex (> 1 hour)
- ❌ Multiple blocking bugs
- ❌ No documentation/support

### Estimated Time
3-4 hours

---

## Expected Outcomes

### If GO ✅
**Deliverables:**
1. Working Flutter test app (Android + macOS)
2. Documented Appium + WebDriverIO configuration
3. Proof-of-concept tests demonstrating commands work
4. Setup guide for users
5. Revised MVP spec with realistic timeline
6. List of known limitations

**Next Steps:**
- Update roadmap Item #3a
- Begin MVP implementation (Week 2)
- Estimated timeline: 6-7 weeks for MVP

### If NO-GO ❌
**Deliverables:**
1. Documentation of issues encountered
2. Recommendation to skip Flutter service
3. Updated roadmap removing/deferring Item #3

**Next Steps:**
- Update roadmap
- Move to Item #4 (Neutralino) or Item #5 (Tauri)
- Consider Flutter again in future if ecosystem matures

---

## Risk Mitigation

### Risk 1: Installation Issues
**Mitigation:** Budget extra time on Day 1, use official docs, check system requirements

### Risk 2: Emulator Won't Start
**Mitigation:** Use Android Studio's built-in emulator manager, ensure enough disk space

### Risk 3: Driver Doesn't Work
**Mitigation:** Check GitHub issues first, try different Flutter versions if needed

### Risk 4: macOS Build Issues
**Mitigation:** Xcode should already be set up from Electron work, verify entitlements

### Risk 5: WebDriverIO Integration Problems
**Mitigation:** Start with simplest possible config, add complexity gradually

---

## Daily Status Updates

### Day 1: October 22, 2025
**Status:** ✅ COMPLETE (with manual steps pending)

**Completed:**
- ✅ Installed Flutter SDK 3.35.6 (via Homebrew)
- ✅ Installed Appium 3.1.0 globally (via pnpm)
- ✅ Installed appium-flutter-integration-driver 2.0.3
- ✅ Verified driver installation and compatibility
- ✅ Installed Android Studio 2025.1.4.8 (via Homebrew)
- ✅ Documented installation process

**Key Findings:**
- **Flutter Version:** 3.35.6 ✅ (well above 3.19 requirement)
- **Appium Version:** 3.1.0 ✅ (latest, even better than 2.x)
- **Driver Version:** 2.0.3 ✅
- **Supported Platforms:** Android, iOS, Mac ✅ (perfect for our MVP)

**Manual Steps Required (User):**
1. **Android Studio Setup:**
   - Open Android Studio (`/Applications/Android Studio.app`)
   - Complete initial setup wizard
   - Install Android SDK components:
     - Android SDK Platform (API 33 or 34 recommended)
     - Android SDK Build-Tools
     - Android Emulator
     - Intel/ARM System Images
   - Create an Android Virtual Device (AVD):
     - Device: Pixel 6 or similar
     - System Image: Android 13 (API 33) or Android 14 (API 34)
     - RAM: 2048 MB minimum
   - Note the SDK location (usually `~/Library/Android/sdk`)

2. **Xcode Setup (Optional for macOS testing):**
   - Install full Xcode from App Store (if not already installed)
   - Run: `sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer`
   - Run: `sudo xcodebuild -runFirstLaunch`
   - Accept license: `sudo xcodebuild -license accept`
   - Install CocoaPods: `brew install cocoapods`

3. **Flutter Configuration:**
   - After Android SDK is installed, run: `flutter doctor --android-licenses` (accept all)
   - Run: `flutter doctor` to verify setup

**Blockers:**
- None for installation
- Waiting on manual user setup for Android Studio + emulator

**Tomorrow (Day 2):**
- Once Android setup complete, create Flutter test app
- Add integration_test to project
- Build Android APK (debug)
- Build macOS app (debug)
- Verify builds succeed

### Day 2: [DATE]
**Status:**
**Completed:**
**Blockers:**
**Tomorrow:**

### Day 3: [DATE]
**Status:**
**Completed:**
**Blockers:**
**Tomorrow:**

### Day 4: [DATE]
**Status:**
**Completed:**
**Blockers:**
**Tomorrow:**

### Day 5: [DATE]
**Status:**
**Decision:**
**Recommendation:**
**Next Steps:**

---

## Resources

### Documentation
- [Flutter Installation](https://docs.flutter.dev/get-started/install)
- [Appium Documentation](https://appium.io/docs/en/2.0/)
- [appium-flutter-integration-driver](https://github.com/appium/appium-flutter-integration-driver)
- [Sauce Labs Guide](https://docs.saucelabs.com/mobile-apps/automated-testing/appium/appium-flutter-integration-driver/)
- [integration_test Package](https://docs.flutter.dev/testing/integration-tests)

### Community
- [Appium Discussions](https://discuss.appium.io/)
- [Flutter Discord](https://discord.gg/flutter)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/flutter)

---

## Success Metrics

**Research spike is successful if:**
1. ✅ Clear GO/NO-GO decision made
2. ✅ Technical feasibility validated
3. ✅ Realistic timeline established
4. ✅ Known limitations documented
5. ✅ Setup process documented

**Time spent:** Max 1 week (40 hours)
**Value:** Avoids 6-12 weeks of wasted implementation if not feasible

