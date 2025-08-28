#!/usr/bin/env node

import { main } from './index.js'

main().catch(error => {
  console.error('[Main] Unhandled error:', error)
  process.exit(1)
})