# CrabNebula API Key Outreach Template

## Subject: Request for OSS API Key - WebdriverIO Tauri Service Integration

---

Hi CrabNebula Team,

I'm reaching out on behalf of the WebdriverIO project (https://webdriver.io/). We're the maintainers of the official WebdriverIO Tauri service (@wdio/tauri-service), which provides end-to-end testing capabilities for Tauri applications.

## Context

We've recently completed a full integration of CrabNebula's tauri-driver into our service to enable macOS testing support for the Tauri community. This integration allows WebdriverIO users to seamlessly use your macOS WebDriver implementation alongside the official tauri-driver for Linux and Windows.

## What We've Built

Our implementation includes:

1. **Automatic Backend Management** - The service automatically starts/stops the test-runner-backend process
2. **Plugin Validation** - We validate that users have the tauri-plugin-automation installed
3. **CN_API_KEY Integration** - Full support for your API key authentication
4. **Documentation** - Complete setup guides for users wanting to use CrabNebula
5. **Backward Compatibility** - Users can choose between 'official' and 'crabnebula' driver providers

## Why We Need an API Key

To properly test and maintain this integration, we need a CrabNebula API key for our CI/CD pipeline. Specifically:

- **Repository**: https://github.com/webdriverio/desktop-mobile
- **Package**: @wdio/tauri-service
- **Use Case**: Automated testing of the CrabNebula integration in CI
- **Expected Usage**: Low-volume, only during CI runs for PR validation

## What We're Asking For

We'd like to request an OSS (Open Source Software) API key that would allow us to:

1. Run integration tests in our CI pipeline
2. Ensure the CrabNebula driver integration works correctly
3. Provide confidence to users that the integration is well-tested

## Our Commitments

If provided with an API key, we commit to:

- Using it solely for CI/testing purposes
- Not sharing the key publicly (it will be stored as a GitHub secret)
- Providing feedback on any issues we encounter
- Promoting CrabNebula as a recommended option for macOS Tauri testing

## Questions for You

1. Do you offer OSS licenses/API keys for open source projects like ours?
2. What are the usage limits for such a key?
3. Is there a specific process we need to follow?
4. Would you be open to a partnership where we officially recommend CrabNebula for macOS testing?

We're excited about the possibility of offering our users a complete cross-platform testing solution, and CrabNebula's macOS support is a crucial piece of that puzzle.

Looking forward to hearing from you!

Best regards,

[Your Name]
[Your Title]
WebdriverIO Project

---

## Follow-up Email (if no response after 1 week)

**Subject**: Re: Request for OSS API Key - WebdriverIO Tauri Service Integration

Hi again,

Just wanted to follow up on my previous email regarding an OSS API key for the WebdriverIO Tauri service integration.

We've completed the implementation and it's ready for testing. You can see the PR here: [LINK TO PR]

Would love to discuss how we can collaborate to provide the best testing experience for Tauri developers.

Thanks,
[Your Name]

---

## Alternative Contact Methods

If email doesn't work, try:

1. **Discord**: CrabNebula has a Discord community - join and ask in the #general or #support channel
2. **Twitter/X**: Reach out to @crabnebula_dev publicly
3. **GitHub**: Open an issue on their public repos asking about OSS partnerships
4. **Website Contact Form**: Use their website contact form

## Key Talking Points

- Emphasize that this is for an established, popular open source project (WebdriverIO)
- Highlight that this will drive users to CrabNebula's paid service
- Mention that it's low-volume CI usage, not production load
- Offer to provide testimonials or case studies in exchange
- Be flexible - they might offer a limited key or trial period initially
