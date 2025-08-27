# Publishing Guide

This project supports multiple methods for publishing to npm, with OIDC being the preferred method for enhanced security.

## 🔐 Method 1: OIDC (Recommended - No Token Required!)

GitHub Actions can authenticate directly with npm using OIDC (OpenID Connect), eliminating the need for long-lived tokens.

### Prerequisites for OIDC

1. **Configure npm account for OIDC**:
   - Log in to [npmjs.com](https://www.npmjs.com)
   - Go to Account Settings → Access Tokens
   - Enable "Publish with GitHub Actions" 
   - Add your repository: `xuanwo/acp-claude-code-polish`

2. **No secrets needed!** The workflow uses GitHub's OIDC provider automatically.

### Publishing with OIDC

1. **Via Git tag** (Recommended):
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **Via GitHub UI**:
   - Go to Releases → Create a new release
   - Create a new tag (e.g., `v1.0.0`)
   - Publish release

3. **Manual dispatch**:
   - Go to Actions → "Publish Package" workflow
   - Click "Run workflow"
   - Enter version and tag

## 🔑 Method 2: NPM Token (Fallback)

If OIDC is not configured, the workflow will automatically fall back to using an NPM token.

### Setup NPM Token

1. **Generate token on npm**:
   ```bash
   npm login
   npm token create --read-only=false
   ```
   Or via [npmjs.com](https://www.npmjs.com) → Account Settings → Access Tokens

2. **Add to GitHub Secrets**:
   - Go to Settings → Secrets and variables → Actions
   - Add new secret named `NPM_TOKEN`
   - Paste your npm token

## 📦 Package Provenance

When publishing with OIDC, packages automatically include provenance attestations, providing:
- **Build transparency**: Links package to source code and build
- **Supply chain security**: Cryptographic proof of build origin
- **Trust indicators**: npm displays verified publisher badge

## 🚀 Publishing Workflows

### Production Release
```bash
# Create and push a tag
git tag v1.2.3
git push origin v1.2.3
```

### Beta Release
```bash
# Create a prerelease tag
git tag v1.2.3-beta.1
git push origin v1.2.3-beta.1
```

### Manual Release
1. Go to Actions → "Publish Package"
2. Click "Run workflow"
3. Enter:
   - Version: `1.2.3`
   - Tag: `latest`, `beta`, `next`, or `alpha`

## ✅ Verification

After publishing, verify your package:

1. **Check npm registry**:
   ```bash
   npm view acp-claude-code@latest
   ```

2. **Verify provenance** (OIDC only):
   ```bash
   npm view acp-claude-code --json | jq '.dist.attestations'
   ```

3. **Check package page**:
   Visit https://www.npmjs.com/package/acp-claude-code

## 🔍 Troubleshooting

### OIDC Publishing Fails

If OIDC publishing fails, check:
1. Repository is correctly configured in npm account
2. Workflow has `id-token: write` permission
3. Package name matches npm configuration

The workflow will automatically fall back to token-based auth if:
- OIDC is not configured
- `NPM_TOKEN` secret is available

### Token Publishing Fails

If token publishing fails:
1. Ensure `NPM_TOKEN` is set in GitHub Secrets
2. Token has publish permissions
3. Token hasn't expired

## 📋 Workflow Features

The publish workflow includes:
- ✅ Automatic version detection from tags
- ✅ TypeScript compilation and linting
- ✅ Provenance attestations (OIDC)
- ✅ Automatic GitHub Release creation
- ✅ Multi-tag support (latest, beta, next, alpha)
- ✅ Fallback from OIDC to token
- ✅ Build artifacts in releases
- ✅ Publish summary in workflow