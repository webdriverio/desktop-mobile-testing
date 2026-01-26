# Roadmap

This document outlines the planned services and their development sequencing for the WebdriverIO Desktop & Mobile Testing project.

## Current Services (Available)

### [@wdio/electron-service](./packages/electron-service) - v10.x
**Status:** ✅ Stable (migrated from legacy repo)\
**Platforms:** Windows, macOS, Linux

### [@wdio/tauri-service](./packages/tauri-service) - v1.x
**Status:** 🚧 Pre-release\
**Platforms:** Windows, Linux (macOS via CrabNebula's forked `tauri-driver`)

## Planned Services

### Phase 1: Dioxus Desktop (Q2 2026)
**Priority:** High - Emerging Rust ecosystem integration

**Target Platforms:** Windows, macOS, Linux

**Why Dioxus first:**
- Modern Rust-based framework gaining traction
- Similar architecture to Tauri (leverage existing patterns)
- Desktop-first approach aligns with current offerings
- Growing community interest

**Technical approach:**
- Wry webview automation (WebView2/WKWebView/WebKitGTK)
- DevTools protocol via CDP sessions (standard Chromedriver)
- Standard WDIO parallelization
- Reuses Tauri service launch detection patterns

### Phase 2: React Native Mobile (Q3 2026)
**Priority:** High - Mobile testing expansion

**Target Platforms:** iOS, Android
**Future:** Windows, macOS, Linux (desktop support)

**Why React Native:**
- Massive ecosystem and user base
- Well-established mobile testing needs
- Appium integration already proven
- Establishes mobile scaffold pattern

**Technical approach:**
- Appium server + hybrid context switching
- XCUITest driver (iOS)
- UiAutomator2 driver (Android)
- Standard WebdriverIO Appium patterns

### Phase 3: Flutter Mobile (Q4 2026)
**Priority:** Medium - Mobile testing completion

**Target Platforms:** iOS, Android

**Why Flutter:**
- Google backing and strong mobile presence
- Production-ready Appium Flutter Driver
- Complements React Native mobile coverage
- Reuses mobile scaffold

**Technical approach:**
- Appium Flutter Driver integration
- Standard WebdriverIO Appium patterns

### Phase 4: Capacitor Mobile (Q1 2027)
**Priority:** Medium - Ionic ecosystem coverage

**Target Platforms:** iOS, Android

**Why Capacitor:**
- Ionic's 1M+ app ecosystem
- Pure WebView pattern (zero new complexity)
- Replaces deprecated Cordova/PhoneGap
- Perfect mobile scaffold consumer

**Technical approach:**
- Standard Appium WebView context switching
- appPackage/appActivity capabilities

### Phase 5: Neutralino Desktop (Q2 2027)
**Priority:** Low - Niche use case

**Target Platforms:** Windows, macOS, Linux

**Why Neutralino:**
- Extremely lightweight alternative to Electron
- JavaScript ecosystem alignment
- Web-based architecture

**Technical approach:**
- System webview automation via ChromeDriver CDP  
- `neutralinojs --enable-inspector` launch integration
- Electron service patterns (devtools endpoint detection)
- Standard WebdriverIO parallelization

### Phase 6: Dioxus Mobile Experimental (Q3 2027)
**Priority:** Low - Experimental platform

**Target Platforms:** iOS, Android (experimental)

**Why experimental:**
- Dioxus mobile is early-stage
- Reuses established mobile scaffold
- Completes Rust ecosystem coverage

### Phase 7: React Native Desktop (Q4 2027)
**Priority:** Low - Desktop expansion

**Target Platforms:** Windows, macOS, Linux

**Why later:**
- Less mature than React Native mobile
- Lower demand vs mobile priorities
- Leverages Phase 2 mobile experience



## Not Planned

These frameworks are not currently on the roadmap:

- **NW.js** - Declining popularity, overlaps with Electron
- **Cordova/PhoneGap** - Deprecated (2020), replaced by Capacitor
- **Qt/QML** - Native rendering, no WebDriver fit
- **.NET MAUI** - Native UI, platform-specific drivers
- **Blazor** - Standard web (no service needed), Hybrid WebView context switching unreliable
- **Wails** - Go webview, no established automation patterns

## Evaluation Criteria

When prioritizing services, we consider:

1. **Market demand** - User requests and ecosystem size
2. **Technical feasibility** - Availability of drivers and tooling
3. **Maintenance burden** - Ongoing support requirements
4. **Ecosystem maturity** - Framework stability and community
5. **Platform coverage** - Mobile vs desktop gaps
6. **Integration complexity** - Development effort required

## Contributing to Roadmap

We welcome community input on the roadmap! To suggest changes:

1. Open a [GitHub Discussion](https://github.com/webdriverio/desktop-mobile/discussions)
2. Provide use case and demand evidence
3. Suggest technical approach if known
4. Indicate willingness to contribute

Roadmap priorities may shift based on:
- Community contributions
- Framework ecosystem changes
- Technical breakthroughs
- Market demand shifts

## Timeline Disclaimer

Timelines are estimates and subject to change based on:
- Maintainer availability
- Community contributions
- Technical challenges
- Framework ecosystem changes

All dates should be considered aspirational goals rather than commitments.
