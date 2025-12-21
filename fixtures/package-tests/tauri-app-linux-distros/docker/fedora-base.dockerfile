FROM fedora:40

ENV CI=true

# Install basic requirements but explicitly NOT webkit2gtk-driver
RUN dnf install -y \
        curl \
        ca-certificates \
        sudo \
        git \
        nodejs \
        npm \
        gcc \
        gcc-c++ \
        make \
        pkg-config \
        openssl-devel && \
    dnf clean all

# Install pnpm globally
RUN npm install -g pnpm

# Install Rust toolchain (needed for tauri-driver auto-install)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Tauri runtime dependencies (but NOT webkit2gtk-driver)
RUN dnf install -y \
        webkit2gtk4.1-devel \
        libappindicator-gtk3-devel \
        librsvg2-devel \
        libxdo-devel \
        wget \
        file && \
    dnf clean all

# Create test user with sudo access
RUN useradd -m -s /bin/bash testuser && \
    echo 'testuser ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Ensure clean environment by removing any webkit2gtk-driver packages
RUN dnf remove -y webkit2gtk-driver || true && \
    dnf autoremove -y && \
    rm -f /usr/bin/WebKitWebDriver && \
    dnf clean all

# Verify WebKitWebDriver is NOT available
RUN ! which WebKitWebDriver || exit 1

WORKDIR /app
USER testuser

CMD ["bash"]
