FROM alpine:latest

ENV CI=true

# Install basic requirements
RUN apk add --no-cache \
        curl \
        ca-certificates \
        sudo \
        git \
        bash \
        nodejs \
        npm \
        build-base

# Install pnpm globally
RUN npm install -g pnpm

# Install Rust toolchain (needed for tauri-driver)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Tauri runtime dependencies (webkit2gtk-4.1 includes WebKitWebDriver)
RUN apk add --no-cache \
        webkit2gtk-4.1 \
        webkit2gtk-4.1-dev \
        gtk+3.0-dev \
        librsvg-dev

# Create test user with sudo access
RUN adduser -D -s /bin/bash testuser && \
    echo 'testuser ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Verify WebKitWebDriver is available (version-specific binary)
RUN which WebKitWebDriver-4.1 || test -f /usr/bin/WebKitWebDriver-4.1

WORKDIR /app
USER testuser

CMD ["bash"]
