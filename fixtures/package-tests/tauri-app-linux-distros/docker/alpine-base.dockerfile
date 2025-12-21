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
        build-base \
        openssl-dev

# Install pnpm globally
RUN npm install -g pnpm

# Install Rust toolchain (needed for tauri-driver)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Tauri runtime dependencies WITHOUT webkit2gtk-driver
# Note: Alpine/musl requires additional static libraries for linking
RUN apk add --no-cache \
        webkit2gtk-4.1-dev \
        libayatana-appindicator-dev \
        librsvg \
        glib-dev \
        glib-static \
        gettext-dev \
        gettext-static \
        wget

# Remove webkit2gtk-driver if present
RUN apk del webkit2gtk-driver || true

# Create test user with sudo access
RUN adduser -D -s /bin/bash testuser && \
    echo 'testuser ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Verify WebKitWebDriver is NOT available
RUN ! which WebKitWebDriver || exit 1

WORKDIR /app
USER testuser

CMD ["bash"]
