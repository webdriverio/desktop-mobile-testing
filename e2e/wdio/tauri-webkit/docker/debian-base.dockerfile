FROM debian:12

ENV DEBIAN_FRONTEND=noninteractive
ENV CI=true

# Install basic requirements
RUN apt-get update && \
    apt-get install -y \
        curl \
        ca-certificates \
        sudo \
        git \
        gnupg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install pnpm globally
RUN npm install -g pnpm

# Install Rust toolchain (needed for tauri-driver)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Tauri runtime dependencies WITHOUT webkit2gtk-driver
RUN apt-get update && \
    apt-get install -y \
        libwebkit2gtk-4.1-dev \
        libgtk-3-dev \
        libayatana-appindicator3-dev \
        librsvg2-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Explicitly remove webkit2gtk-driver if present
RUN apt-get remove -y webkit2gtk-driver || true

# Create test user with sudo access
RUN useradd -m -s /bin/bash testuser && \
    echo 'testuser ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Verify WebKitWebDriver is NOT available
RUN ! which WebKitWebDriver || exit 1

WORKDIR /app
USER testuser

CMD ["bash"]
