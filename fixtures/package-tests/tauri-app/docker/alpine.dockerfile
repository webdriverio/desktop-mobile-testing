FROM alpine:latest

ENV CI=true

# Install basic requirements including xvfb for headless testing
RUN apk add --no-cache \
        curl \
        ca-certificates \
        sudo \
        git \
        bash \
        nodejs \
        npm \
        build-base \
        openssl-dev \
        xvfb

# Install pnpm globally
RUN npm install -g pnpm

# Install Rust toolchain (needed for tauri-driver)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Tauri runtime dependencies
# Note: webkit2gtk-4.1 includes WebKitWebDriver-4.1 at /usr/bin/WebKitWebDriver-4.1
# Alpine/musl requires static libraries for linking
RUN apk add --no-cache \
        webkit2gtk-4.1 \
        webkit2gtk-4.1-dev \
        libayatana-appindicator-dev \
        librsvg \
        glib-dev \
        glib-static \
        gettext-dev \
        gettext-static \
        gtk+3.0-dev \
        cairo-dev \
        cairo-static \
        pango-dev \
        pango-static \
        gdk-pixbuf-dev \
        gdk-pixbuf-static \
        harfbuzz-dev \
        harfbuzz-static \
        libxcb-dev \
        libxcb-static \
        xcb-util-dev \
        xcb-util-renderutil-dev \
        xcb-util-wm-dev \
        xcb-util-image-dev \
        zlib-dev \
        zlib-static \
        atk-dev \
        atk-static \
        libsoup3-dev \
        libsoup3-static \
        libintl-static \
        wget

# Set PKG_CONFIG_PATH to ensure .pc files are found
ENV PKG_CONFIG_PATH=/usr/lib/pkgconfig:/usr/share/pkgconfig

# Verify pkg-config can find required libraries
RUN pkg-config --modversion glib-2.0 || (echo "ERROR: pkg-config cannot find glib-2.0" && exit 1)

# Create generic symlink for WebKitWebDriver
RUN ln -s /usr/bin/WebKitWebDriver-4.1 /usr/bin/WebKitWebDriver

# Create test user with sudo access
RUN adduser -D -s /bin/bash testuser && \
    echo 'testuser ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Verify WebKitWebDriver is available
RUN which WebKitWebDriver || test -f /usr/bin/WebKitWebDriver

WORKDIR /app
USER testuser

CMD ["bash"]
