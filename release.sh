#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get version from app.json
VERSION=$(node -p "require('./app.json').expo.version")

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Wynter Code Mobile - Release Script  ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check for required tools
check_requirements() {
    echo -e "${YELLOW}Checking requirements...${NC}"

    if ! command -v eas &> /dev/null; then
        echo -e "${RED}Error: EAS CLI is not installed.${NC}"
        echo "Install it with: npm install -g eas-cli"
        exit 1
    fi

    if ! command -v gh &> /dev/null; then
        echo -e "${RED}Error: GitHub CLI is not installed.${NC}"
        echo "Install it with: brew install gh"
        exit 1
    fi

    echo -e "${GREEN}All requirements met!${NC}"
}

# Login check
check_auth() {
    echo -e "${YELLOW}Checking authentication...${NC}"

    if ! eas whoami &> /dev/null; then
        echo -e "${RED}Not logged in to EAS. Please run: eas login${NC}"
        exit 1
    fi

    if ! gh auth status &> /dev/null; then
        echo -e "${RED}Not logged in to GitHub. Please run: gh auth login${NC}"
        exit 1
    fi

    echo -e "${GREEN}Authenticated!${NC}"
}

# Build for TestFlight
build_ios() {
    echo ""
    echo -e "${BLUE}Building iOS for TestFlight...${NC}"
    echo ""

    # Build and submit to TestFlight
    eas build --platform ios --profile production --auto-submit

    echo -e "${GREEN}iOS build submitted to TestFlight!${NC}"
}

# Build for internal testing (creates IPA)
build_preview() {
    echo ""
    echo -e "${BLUE}Building iOS preview (internal distribution)...${NC}"
    echo ""

    eas build --platform ios --profile preview

    echo -e "${GREEN}Preview build complete!${NC}"
}

# Create GitHub release
create_release() {
    echo ""
    echo -e "${BLUE}Creating GitHub release v${VERSION}...${NC}"
    echo ""

    # Get latest build URL from EAS
    BUILD_URL=$(eas build:list --platform ios --status finished --limit 1 --json | node -p "JSON.parse(require('fs').readFileSync('/dev/stdin').toString())[0]?.artifacts?.buildUrl || ''")

    # Create release notes
    RELEASE_NOTES="## Wynter Code Mobile v${VERSION}

### Installation

#### TestFlight (Recommended)
Join our TestFlight beta to receive automatic updates:
1. Download TestFlight from the App Store
2. [Join the beta](https://testflight.apple.com/join/YOUR_TESTFLIGHT_LINK)

#### Manual Installation
You can also install the app manually using the IPA file below (requires signing).

### What's New
- Mobile companion app for Wynter Code desktop
- View and manage beads issues from your phone
- Monitor auto-build status in real-time
- Chat with Claude and approve tool calls
- QR code pairing for easy setup

### Requirements
- iOS 15.0 or later
- Wynter Code desktop app running with Mobile Companion enabled
"

    # Create the release
    if [ -n "$BUILD_URL" ]; then
        echo "$RELEASE_NOTES" | gh release create "v${VERSION}" \
            --title "Wynter Code Mobile v${VERSION}" \
            --notes-file - \
            --draft

        echo -e "${GREEN}Draft release created!${NC}"
        echo "Build URL: $BUILD_URL"
        echo ""
        echo "Next steps:"
        echo "1. Download the IPA from EAS: $BUILD_URL"
        echo "2. Upload it to the GitHub release"
        echo "3. Publish the release"
    else
        echo "$RELEASE_NOTES" | gh release create "v${VERSION}" \
            --title "Wynter Code Mobile v${VERSION}" \
            --notes-file - \
            --draft

        echo -e "${YELLOW}Draft release created (no build artifact found)${NC}"
        echo "Run the build first, then attach the IPA manually."
    fi
}

# Bump version
bump_version() {
    local bump_type=$1

    echo -e "${YELLOW}Bumping ${bump_type} version...${NC}"

    # Parse current version
    IFS='.' read -r major minor patch <<< "$VERSION"

    case $bump_type in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch)
            patch=$((patch + 1))
            ;;
        *)
            echo -e "${RED}Invalid bump type. Use: major, minor, or patch${NC}"
            exit 1
            ;;
    esac

    NEW_VERSION="${major}.${minor}.${patch}"

    # Update app.json
    node -e "
        const fs = require('fs');
        const app = require('./app.json');
        app.expo.version = '${NEW_VERSION}';
        fs.writeFileSync('./app.json', JSON.stringify(app, null, 2) + '\n');
    "

    # Update package.json
    node -e "
        const fs = require('fs');
        const pkg = require('./package.json');
        pkg.version = '${NEW_VERSION}';
        fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
    "

    echo -e "${GREEN}Version bumped: ${VERSION} -> ${NEW_VERSION}${NC}"
}

# Show help
show_help() {
    echo "Usage: ./release.sh [command]"
    echo ""
    echo "Commands:"
    echo "  testflight    Build and submit to TestFlight"
    echo "  preview       Build for internal testing (IPA)"
    echo "  release       Create a GitHub release draft"
    echo "  bump          Bump version (major|minor|patch)"
    echo "  full          Full release: bump patch, build, release"
    echo "  help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./release.sh testflight     # Submit to TestFlight"
    echo "  ./release.sh bump patch     # Bump patch version"
    echo "  ./release.sh full           # Full release workflow"
}

# Main
main() {
    cd "$(dirname "$0")"

    case "${1:-help}" in
        testflight)
            check_requirements
            check_auth
            build_ios
            ;;
        preview)
            check_requirements
            check_auth
            build_preview
            ;;
        release)
            check_requirements
            check_auth
            create_release
            ;;
        bump)
            bump_version "${2:-patch}"
            ;;
        full)
            check_requirements
            check_auth
            bump_version "patch"
            build_ios
            create_release
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            echo -e "${RED}Unknown command: $1${NC}"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
