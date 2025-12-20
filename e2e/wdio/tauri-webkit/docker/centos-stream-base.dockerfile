FROM quay.io/centos/centos:stream9

ENV CI=true

# Install basic requirements
RUN dnf install -y \
        curl \
        ca-certificates \
        sudo \
        git && \
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
        gtk3-devel \
        librsvg2-devel && \
    dnf clean all

# Remove webkit2gtk-driver if present
RUN dnf remove -y webkit2gtk-driver || true

# Create test user with sudo access
RUN useradd -m -s /bin/bash testuser && \
    echo 'testuser ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Verify WebKitWebDriver is NOT available
RUN ! which WebKitWebDriver || exit 1

WORKDIR /app
USER testuser

CMD ["bash"]
