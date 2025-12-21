FROM quay.io/centos/centos:stream9

ENV CI=true

# Install basic requirements (use --allowerasing to replace curl-minimal with curl)
RUN dnf install -y --allowerasing \
        curl \
        ca-certificates \
        sudo \
        git \
        gcc \
        gcc-c++ \
        make \
        pkg-config \
        openssl-devel && \
    dnf clean all

# Install Node.js 20.x
RUN curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - && \
    dnf install -y nodejs && \
    dnf clean all

# Install pnpm globally
RUN npm install -g pnpm

# Install Rust toolchain (needed for tauri-driver)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Tauri runtime dependencies WITHOUT webkit2gtk-driver
RUN dnf install -y \
        webkit2gtk4.1-devel \
        libappindicator-gtk3-devel \
        librsvg2-devel \
        libxdo-devel \
        wget \
        file && \
    dnf clean all && \
    rm -f /usr/bin/WebKitWebDriver /usr/sbin/WebKitWebDriver /usr/libexec/webkit2gtk-4.0/WebKitWebDriver

# Create test user with sudo access
RUN useradd -m -s /bin/bash testuser && \
    echo 'testuser ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Verify WebKitWebDriver is NOT available
RUN ! which WebKitWebDriver || exit 1

WORKDIR /app
USER testuser

CMD ["bash"]
