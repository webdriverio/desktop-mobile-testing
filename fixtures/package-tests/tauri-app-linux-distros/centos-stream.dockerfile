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

# Install Tauri runtime dependencies
# Note: CentOS Stream 9 only has webkit2gtk3, not 4.1
# webkit2gtk3 includes WebKitWebDriver at /usr/bin/WebKitWebDriver
RUN dnf install -y \
        webkit2gtk3 \
        webkit2gtk3-devel \
        gtk3-devel \
        librsvg2-devel \
        wget \
        file && \
    dnf clean all

# Create test user with sudo access
RUN useradd -m -s /bin/bash testuser && \
    echo 'testuser ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Verify WebKitWebDriver is available
RUN test -f /usr/bin/WebKitWebDriver

WORKDIR /app
USER testuser

CMD ["bash"]
