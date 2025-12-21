FROM ubuntu:24.04

# Avoid interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive
ENV CI=true

# Install basic requirements but explicitly NOT webkit2gtk-driver
RUN apt-get update -qq && \
    apt-get install -y \
        curl \
        ca-certificates \
        gnupg \
        sudo \
        git && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Node.js from NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Install pnpm globally as root
RUN npm install -g pnpm

# Install Rust toolchain (needed for tauri-driver auto-install)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Tauri runtime dependencies (but NOT webkit2gtk-driver)
RUN apt-get update -qq && \
    apt-get install -y \
        libwebkit2gtk-4.1-0 \
        libgtk-3-0 \
        libayatana-appindicator3-1 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create test user with sudo access
RUN useradd -m -s /bin/bash testuser && \
    echo 'testuser ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Ensure clean environment by removing any webkit2gtk-driver packages
RUN apt-get update -qq && \
    apt-get remove -y webkit2gtk-driver || true && \
    apt-get autoremove -y && \
    rm -f /usr/bin/WebKitWebDriver && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Verify WebKitWebDriver is NOT available
RUN ! which WebKitWebDriver || exit 1

WORKDIR /app
USER testuser

# Default command
CMD ["bash"]
