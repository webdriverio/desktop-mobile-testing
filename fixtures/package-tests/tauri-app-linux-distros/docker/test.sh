#!/bin/bash

# Script to test Docker builds locally for debugging
# Usage: ./test.sh [distro] [mode]
# Example: ./test.sh void
# Example: ./test.sh all
# Example: ./test.sh void build
# Example: ./test.sh void test
# Example: ./test.sh void debug

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test a single dockerfile
test_dockerfile() {
    local distro=$1
    local scenario=$2
    local dockerfile=$3

    echo -e "${YELLOW}=== Testing $distro ($scenario) ===${NC}"

    # Try to build the Docker image
    if docker build \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        --progress=plain \
        -f "$SCRIPT_DIR/$dockerfile" \
        -t "tauri-distro-test:$distro-$scenario" \
        "$REPO_ROOT" 2>&1 | tee "/tmp/docker-build-$distro-$scenario.log"; then
        echo -e "${GREEN}✓ Build succeeded for $distro ($scenario)${NC}"
        return 0
    else
        echo -e "${RED}✗ Build failed for $distro ($scenario)${NC}"
        echo -e "${RED}  Log saved to: /tmp/docker-build-$distro-$scenario.log${NC}"
        return 1
    fi
}

# Function to run tests in a built container
run_tests_in_container() {
    local distro=$1
    local scenario=$2

    echo -e "${YELLOW}=== Running tests for $distro ($scenario) ===${NC}"

    if docker run --rm \
        -u root \
        -v "$REPO_ROOT:/workspace" \
        -w /workspace \
        "tauri-distro-test:$distro-$scenario" \
        bash -c "
            set -e
            export TURBO_TELEMETRY_DISABLED=1

            echo '=== Installing dependencies ==='
            pnpm install --frozen-lockfile

            echo '=== Building tauri-service package ==='
            pnpm turbo run build --filter=@wdio/tauri-service

            echo '=== Building Tauri app ==='
            cd fixtures/package-tests/tauri-app
            pnpm run build:debug

            echo '=== Running Tauri package test ==='
            pnpm test
        " 2>&1 | tee "/tmp/docker-test-$distro-$scenario.log"; then
        echo -e "${GREEN}✓ Tests passed for $distro ($scenario)${NC}"
        return 0
    else
        echo -e "${RED}✗ Tests failed for $distro ($scenario)${NC}"
        echo -e "${RED}  Log saved to: /tmp/docker-test-$distro-$scenario.log${NC}"
        return 1
    fi
}

# Function to debug a failing dockerfile
debug_dockerfile() {
    local distro=$1
    local scenario=$2
    local dockerfile=$3

    echo -e "${YELLOW}=== Debugging $distro ($scenario) ===${NC}"
    echo "Building with verbose output and stopping at first error..."

    docker build \
        --progress=plain \
        --no-cache \
        -f "$SCRIPT_DIR/$dockerfile" \
        -t "tauri-distro-test:$distro-$scenario-debug" \
        "$REPO_ROOT" || {
            echo -e "${RED}Build failed. You can try building layer by layer to identify the issue.${NC}"
            echo "Tip: Comment out RUN commands in the Dockerfile one by one to find the failing step."
        }
}

# Main script
DISTRO="${1:-all}"
MODE="${2:-build}"  # build, test, or debug

case "$MODE" in
    build)
        echo "Building Docker images..."
        ;;
    test)
        echo "Building and testing Docker images..."
        ;;
    debug)
        echo "Debugging Docker builds..."
        ;;
    *)
        echo "Unknown mode: $MODE"
        echo "Usage: $0 [distro] [build|test|debug]"
        exit 1
        ;;
esac

# Function to get test case data
get_test_case() {
    case "$1" in
        ubuntu-base)
            echo "ubuntu base ubuntu-base.dockerfile"
            ;;
        ubuntu-webkit)
            echo "ubuntu with-webkit ubuntu-with-webkit.dockerfile"
            ;;
        fedora-base)
            echo "fedora base fedora-base.dockerfile"
            ;;
        fedora-webkit)
            echo "fedora with-webkit fedora-with-webkit.dockerfile"
            ;;
        debian-base)
            echo "debian base debian-base.dockerfile"
            ;;
        debian-webkit)
            echo "debian with-webkit debian-with-webkit.dockerfile"
            ;;
        centos-base)
            echo "centos-stream base centos-stream-base.dockerfile"
            ;;
        centos-webkit)
            echo "centos-stream with-webkit centos-stream-with-webkit.dockerfile"
            ;;
        arch-base)
            echo "arch base arch-base.dockerfile"
            ;;
        arch-webkit)
            echo "arch with-webkit arch-with-webkit.dockerfile"
            ;;
        alpine-base)
            echo "alpine base alpine-base.dockerfile"
            ;;
        alpine-webkit)
            echo "alpine with-webkit alpine-with-webkit.dockerfile"
            ;;
        suse-base)
            echo "suse base suse-base.dockerfile"
            ;;
        void-base)
            echo "void base void-base.dockerfile"
            ;;
        void-webkit)
            echo "void with-webkit void-with-webkit.dockerfile"
            ;;
        *)
            echo ""
            ;;
    esac
}

# Get all available test keys
get_all_test_keys() {
    echo "ubuntu-base ubuntu-webkit fedora-base fedora-webkit debian-base debian-webkit centos-base centos-webkit arch-base arch-webkit alpine-base alpine-webkit suse-base void-base void-webkit"
}

# Filter test cases based on distro argument
if [ "$DISTRO" = "all" ]; then
    selected_tests=$(get_all_test_keys)
else
    selected_tests=""
    for key in $(get_all_test_keys); do
        case "$key" in
            $DISTRO*)
                selected_tests="$selected_tests $key"
                ;;
        esac
    done

    if [ -z "$selected_tests" ]; then
        echo -e "${RED}No tests found for distro: $DISTRO${NC}"
        echo "Available distros: ubuntu, fedora, debian, centos, arch, alpine, suse, void"
        exit 1
    fi
fi

# Track results
total=0
passed=0
failed=0

# Run tests
for test_key in $selected_tests; do
    test_data=$(get_test_case "$test_key")

    if [ -z "$test_data" ]; then
        echo -e "${RED}Unknown test case: $test_key${NC}"
        continue
    fi

    IFS=' ' read -r distro scenario dockerfile <<< "$test_data"

    total=$((total + 1))

    case "$MODE" in
        build)
            if test_dockerfile "$distro" "$scenario" "$dockerfile"; then
                passed=$((passed + 1))
            else
                failed=$((failed + 1))
            fi
            ;;
        test)
            if test_dockerfile "$distro" "$scenario" "$dockerfile"; then
                if run_tests_in_container "$distro" "$scenario"; then
                    passed=$((passed + 1))
                else
                    failed=$((failed + 1))
                fi
            else
                failed=$((failed + 1))
            fi
            ;;
        debug)
            debug_dockerfile "$distro" "$scenario" "$dockerfile"
            ;;
    esac

    echo ""
done

# Print summary
if [ "$MODE" != "debug" ]; then
    echo -e "${YELLOW}=== Summary ===${NC}"
    echo -e "Total: $total"
    echo -e "${GREEN}Passed: $passed${NC}"
    echo -e "${RED}Failed: $failed${NC}"

    if [ $failed -gt 0 ]; then
        echo -e "\n${RED}Some tests failed. Check logs in /tmp/docker-*.log${NC}"
        exit 1
    else
        echo -e "\n${GREEN}All tests passed!${NC}"
    fi
fi
