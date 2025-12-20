FROM voidlinux/voidlinux:latest

ENV CI=true

# Configure repository mirror to avoid SSL certificate issues
RUN mkdir -p /etc/xbps.d && \
    cp /usr/share/xbps.d/*-repository-*.conf /etc/xbps.d/ && \
    sed -i 's|https://[^/]*/|https://repo-default.voidlinux.org/|g' /etc/xbps.d/*-repository-*.conf

# Install basic requirements (upgrade system deps to avoid conflicts, ignore failures in base-files)
RUN xbps-install -Syu xbps && \
    ( xbps-install -Su || true ) && \
    xbps-install -y \
        curl \
        ca-certificates \
        sudo \
        git \
        bash \
        nodejs && \
    xbps-remove -O

# Install pnpm globally
RUN npm install -g pnpm

# Install Rust toolchain (needed for tauri-driver)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Upgrade util-linux packages first to avoid dependency conflicts
RUN xbps-install -yf util-linux util-linux-common libblkid libuuid libmount libfdisk libsmartcols || true

# Install Tauri runtime dependencies (libwebkit2gtk41 includes WebKitWebDriver)
RUN xbps-install -y \
        libwebkit2gtk41 \
        libwebkit2gtk41-devel \
        gtk+3-devel \
        librsvg-devel && \
    xbps-remove -O

# Create test user with sudo access
RUN useradd -m -s /bin/bash testuser && \
    echo 'testuser ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Verify WebKitWebDriver IS available
RUN which WebKitWebDriver || test -f /usr/sbin/WebKitWebDriver

WORKDIR /app
USER testuser

CMD ["bash"]
