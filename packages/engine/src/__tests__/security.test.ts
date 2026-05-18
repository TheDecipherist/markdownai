// Security tests have been split into focused files:
//   security-filesystem.test.ts — filesystem confinement, config, RuntimeMode, matchGlob
//   security-masking-shell.test.ts — content masking, shell jail, HTTP jail, database jail

import { describe, it } from 'vitest'

describe('security tests', () => {
  it('tests live in security-filesystem.test.ts and security-masking-shell.test.ts', () => {
    // intentionally empty — see split files above
  })
})
