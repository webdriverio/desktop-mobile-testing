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
        npm22 \
        gcc \
        gcc-c++ \
        make \
        pkg-config \
        libopenssl-devel && \
    zypper clean -a

# Install pnpm globally
RUN npm install -g pnpm

# Install Rust toolchain (needed for tauri-driver)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Tauri runtime dependencies WITHOUT webkit2gtk-driver
RUN zypper install -y \
        webkit2gtk3-devel \
        libappindicator3-1 \
        librsvg-devel \
        wget \
        file && \
    zypper clean -a

# Remove webkit2gtk-driver if present
RUN zypper remove -y webkit2gtk-driver || true

# Create test user with sudo access
RUN useradd -m -s /bin/bash testuser && \
    echo 'testuser ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Verify WebKitWebDriver is NOT available
RUN ! which WebKitWebDriver || exit 1

WORKDIR /app
USER testuser

CMD ["bash"]
