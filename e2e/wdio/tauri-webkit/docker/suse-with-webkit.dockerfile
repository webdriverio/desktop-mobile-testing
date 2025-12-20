FROM opensuse/tumbleweed:latest

ENV CI=true

# Install basic requirements
RUN zypper refresh && \
    zypper install -y \
        curl \
        ca-certificates \
        sudo \
        git \
        nodejs22 \
        npm22 && \
    zypper clean -a

# Install pnpm globally
RUN npm install -g pnpm

# Install Rust toolchain (needed for tauri-driver)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Tauri runtime dependencies AND webkit2gtk-driver
RUN zypper install -y \
        webkit2gtk4-devel \
        gtk3-devel \
        librsvg-devel \
        webkit2gtk-driver && \
    zypper clean -a

# Create test user with sudo access
RUN useradd -m -s /bin/bash testuser && \
    echo 'testuser ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Verify WebKitWebDriver IS available
RUN which WebKitWebDriver || ls -la /usr/lib*/webkit2gtk*/WebKitWebDriver

WORKDIR /app
USER testuser

CMD ["bash"]
