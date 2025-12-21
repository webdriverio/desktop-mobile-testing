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

# Install Tauri runtime dependencies (webkit2gtk4.1 for Tauri)
RUN dnf install -y \
        webkit2gtk4.1 \
        webkit2gtk4.1-devel \
        gtk3-devel \
        libayatana-appindicator-gtk3 && \
    dnf clean all

# Install webkitgtk6.0 which provides WebKitWebDriver at /usr/bin/WebKitWebDriver
RUN dnf install -y webkitgtk6.0 && dnf clean all

# Create test user with sudo access
RUN useradd -m -s /bin/bash testuser && \
    echo 'testuser ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Verify WebKitWebDriver is available
RUN test -f /usr/bin/WebKitWebDriver

WORKDIR /app
USER testuser

CMD ["bash"]
