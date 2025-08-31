## [0.6.0](https://github.com/xuanwo/acp-claude-code/compare/v0.5.4...v0.6.0) (2025-08-31)

### Features

* support agent plan ([#51](https://github.com/xuanwo/acp-claude-code/issues/51)) ([a5c94d5](https://github.com/xuanwo/acp-claude-code/commit/a5c94d5e91cd35d1b9878ba8c0a7a6065c83faa4))

## [0.5.4](https://github.com/xuanwo/acp-claude-code/compare/v0.5.3...v0.5.4) (2025-08-30)

### Bug Fixes

* add support for pathToClaudeCodeExecutable ([#48](https://github.com/xuanwo/acp-claude-code/issues/48)) ([aa68737](https://github.com/xuanwo/acp-claude-code/commit/aa68737d3b65bbabcb8af8807d4302707cd09ccc))

## [0.5.3](https://github.com/xuanwo/acp-claude-code/compare/v0.5.2...v0.5.3) (2025-08-29)

### Bug Fixes

* **agent:** update loadSession return type to Promise<void> for compatibility ([#46](https://github.com/xuanwo/acp-claude-code/issues/46)) ([2486229](https://github.com/xuanwo/acp-claude-code/commit/248622985953ec3813c65ea628dc375ff3e28190))

## [0.5.2](https://github.com/xuanwo/acp-claude-code/compare/v0.5.1...v0.5.2) (2025-08-28)

### Bug Fixes

* Handle tool_use in assistant messages and tool_result in user messages ([#45](https://github.com/xuanwo/acp-claude-code/issues/45)) ([d585e19](https://github.com/xuanwo/acp-claude-code/commit/d585e19516a13e406c4316d3ce4b7ac7d55e133f)), closes [#43](https://github.com/xuanwo/acp-claude-code/issues/43)

## [0.5.1](https://github.com/xuanwo/acp-claude-code/compare/v0.5.0...v0.5.1) (2025-08-28)

### Bug Fixes

* Update package.json entry points to use cli.js ([#32](https://github.com/xuanwo/acp-claude-code/issues/32)) ([6cfb2ba](https://github.com/xuanwo/acp-claude-code/commit/6cfb2ba84fead04a37d9fe0d7e7f062429adad08))

## [0.5.0](https://github.com/xuanwo/acp-claude-code/compare/v0.4.0...v0.5.0) (2025-08-28)

### Features

* Add basic code formatting ([#31](https://github.com/xuanwo/acp-claude-code/issues/31)) ([284c3ca](https://github.com/xuanwo/acp-claude-code/commit/284c3ca73356ffde1c7293dba715ac6d03433ef2))

## [0.4.0](https://github.com/xuanwo/acp-claude-code/compare/v0.3.2...v0.4.0) (2025-08-28)

### Features

- Separate CLI entry point from library exports ([#28](https://github.com/xuanwo/acp-claude-code/issues/28)) ([406a38d](https://github.com/xuanwo/acp-claude-code/commit/406a38d3c56754dd45468247a2d35a9c2e070540))

### Documentation

- Add notes on zed's efforts ([c1c0111](https://github.com/xuanwo/acp-claude-code/commit/c1c0111d0fc65ec972a6e3993c405acf116fb23d))

### Miscellaneous

- Upgrade eslint to v9 ([#27](https://github.com/xuanwo/acp-claude-code/issues/27)) ([250e063](https://github.com/xuanwo/acp-claude-code/commit/250e063c4a04de408d1eafc201631602793f6298))

## [0.3.2](https://github.com/xuanwo/acp-claude-code/compare/v0.3.1...v0.3.2) (2025-08-28)

### Bug Fixes

- Make permission and tool use work in zed ([#26](https://github.com/xuanwo/acp-claude-code/issues/26)) ([8b0b458](https://github.com/xuanwo/acp-claude-code/commit/8b0b45852092c2f7b9af6344011a856ee7f7a6d6))

## [0.3.1](https://github.com/xuanwo/acp-claude-code/compare/v0.3.0...v0.3.1) (2025-08-28)

### Bug Fixes

- Remove not needed checks ([#25](https://github.com/xuanwo/acp-claude-code/issues/25)) ([670631d](https://github.com/xuanwo/acp-claude-code/commit/670631debf8ecbdc33957003add12956dc7aa329))

### CI/CD

- Create github releases but not assets ([686e0c9](https://github.com/xuanwo/acp-claude-code/commit/686e0c9606ab3a5d722dc85d79ea2cd83ae305eb))
- **deps:** Bump actions/checkout from 4 to 5 ([#23](https://github.com/xuanwo/acp-claude-code/issues/23)) ([cd2435f](https://github.com/xuanwo/acp-claude-code/commit/cd2435f2467ca312680590f08638540ae432d32e))

## [0.3.0](https://github.com/xuanwo/acp-claude-code/compare/v0.2.2...v0.3.0) (2025-08-27)

### Features

- Support session resume ([#19](https://github.com/xuanwo/acp-claude-code/issues/19)) ([513ec9d](https://github.com/xuanwo/acp-claude-code/commit/513ec9d719178eaf18184c586529f134d0140070))

### CI/CD

- Don't upload dist to github directly ([64cd37d](https://github.com/xuanwo/acp-claude-code/commit/64cd37df1065e880faff38c778aabbb25127b552))

## [0.2.2](https://github.com/xuanwo/acp-claude-code/compare/v0.2.1...v0.2.2) (2025-08-27)

### Bug Fixes

- Fix npm publish again ([#12](https://github.com/xuanwo/acp-claude-code/issues/12)) ([d31b45d](https://github.com/xuanwo/acp-claude-code/commit/d31b45d8bad7be0f602492e726f768157f108abc))
- tool_use not generated correctly ([#14](https://github.com/xuanwo/acp-claude-code/issues/14)) ([58d61b2](https://github.com/xuanwo/acp-claude-code/commit/58d61b2e07ba571c631e7fde5c278d91ea861512))

### CI/CD

- Setup semantic release ([#15](https://github.com/xuanwo/acp-claude-code/issues/15)) ([6cc4507](https://github.com/xuanwo/acp-claude-code/commit/6cc450732904d2fb4d96cd5d170ac4385688f104))
- Use NPM_TOKEN for release ([c98d80d](https://github.com/xuanwo/acp-claude-code/commit/c98d80d53b0ee43f774bc0c764c9bb692fc0b54f))

### Miscellaneous

- Fix wrong fields in package.json ([#16](https://github.com/xuanwo/acp-claude-code/issues/16)) ([cc7d28a](https://github.com/xuanwo/acp-claude-code/commit/cc7d28a7320f808e473826af0780ad730999cb97))
- Remove registry-url during setup node ([fcbdae7](https://github.com/xuanwo/acp-claude-code/commit/fcbdae7c5f9099b434e4b8a2cf0c65efe9b8192e))
