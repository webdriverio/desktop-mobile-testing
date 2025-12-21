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

# Install Tauri runtime dependencies (webkit2gtk-4.1 for Tauri)
RUN pacman -S --noconfirm \
        webkit2gtk-4.1 \
        libappindicator-gtk3 \
        librsvg \
        xdotool \
        wget \
        file && \
    pacman -Scc --noconfirm

# Install webkitgtk-6.0 which provides WebKitWebDriver at /usr/bin/WebKitWebDriver
RUN pacman -S --noconfirm webkitgtk-6.0 && pacman -Scc --noconfirm

# Create test user with sudo access
RUN useradd -m -s /bin/bash testuser && \
    echo 'testuser ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Verify WebKitWebDriver is available
RUN test -f /usr/bin/WebKitWebDriver

WORKDIR /app
USER testuser

CMD ["bash"]
