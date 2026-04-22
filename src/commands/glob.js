import { defineCommand } from 'citty'
import { glob } from 'glob'

export default defineCommand({
  meta: { name: 'glob', description: 'Expand path globs → one path per line on stdout' },
  async run({ args }) {
    const patterns = args._ || []
    if (patterns.length === 0) {
      process.stderr.write('error: provide one or more glob patterns\n')
      process.exit(1)
    }

    const files = (await Promise.all(patterns.map(pattern => glob(pattern, { stat: true, nodir: true })))).flat()
    if (files.length === 0) {
      process.stderr.write('warning: no files matched\n')
      return
    }

    for (const file of files) process.stdout.write(`${file}\n`)
  },
})
