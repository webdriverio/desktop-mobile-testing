FROM voidlinux/voidlinux:latest

ENV CI=true

# Update package database and install basic requirements
RUN xbps-install -Syu xbps && \
    xbps-install -Syu && \
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

# Install Tauri runtime dependencies AND webkit2gtk-driver
RUN xbps-install -y \
        webkit2gtk-devel \
        gtk+3-devel \
        librsvg-devel \
        webkit2gtk-driver && \
    xbps-remove -O

# Create test user with sudo access
RUN useradd -m -s /bin/bash testuser && \
    echo 'testuser ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Verify WebKitWebDriver IS available
RUN which WebKitWebDriver || ls -la /usr/lib/webkit2gtk*/WebKitWebDriver

WORKDIR /app
USER testuser

CMD ["bash"]
