FROM fedora:40

ENV CI=true

# Install basic requirements INCLUDING webkit2gtk-driver
RUN dnf install -y \
        curl \
        ca-certificates \
        sudo \
        git \
        nodejs \
        npm && \
    dnf clean all

# Install pnpm globally
RUN npm install -g pnpm

# Install Rust toolchain (needed for tauri-driver)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Tauri runtime dependencies AND webkit2gtk-driver
RUN dnf install -y \
        webkit2gtk4.1-devel \
        gtk3-devel \
        libayatana-appindicator-gtk3 \
        webkit2gtk-driver && \
    dnf clean all

# Create test user with sudo access
RUN useradd -m -s /bin/bash testuser && \
    echo 'testuser ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Verify WebKitWebDriver IS available
RUN which WebKitWebDriver || ls -la /usr/lib*/webkit2gtk*/WebKitWebDriver

WORKDIR /app
USER testuser

CMD ["bash"]
