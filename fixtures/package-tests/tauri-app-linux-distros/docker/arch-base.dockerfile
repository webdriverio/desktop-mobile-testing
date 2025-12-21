FROM archlinux:latest

ENV CI=true

# Update package database and install basic requirements
RUN pacman -Syu --noconfirm && \
    pacman -S --noconfirm \
        curl \
        ca-certificates \
        sudo \
        git \
        base-devel \
        nodejs \
        npm \
        openssl && \
    pacman -Scc --noconfirm

# Install pnpm globally
RUN npm install -g pnpm

# Install Rust toolchain (needed for tauri-driver)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Tauri runtime dependencies WITHOUT webkit2gtk-driver
RUN pacman -S --noconfirm \
        webkit2gtk-4.1 \
        libappindicator-gtk3 \
        librsvg \
        xdotool \
        wget \
        file && \
    pacman -Scc --noconfirm

# Remove webkit2gtk-driver if present (package name may vary on Arch)
RUN pacman -R --noconfirm webkit2gtk-driver || true

# Create test user with sudo access
RUN useradd -m -s /bin/bash testuser && \
    echo 'testuser ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Verify WebKitWebDriver is NOT available
RUN ! which WebKitWebDriver || exit 1

WORKDIR /app
USER testuser

CMD ["bash"]
