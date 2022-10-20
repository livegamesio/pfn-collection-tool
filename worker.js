'use strict'
const { ProvablyFairNumbers } = require('pfn')
const { multiply } = require('mathjs')

module.exports = function (options, callback) {
  const printOnlyNumbers = options.printOnlyNumbers
  const logTime = ('logTime' in options) ? options.logTime : false

  const chunkScaledLines = []
  const chunkUnscaledLines = []
  const chunkUndividedLines = []
  const chunkRawLines = []

  const qName = `chunk-${options.start}-${options.end}`
  logTime && console.time(qName)

  //
  for (let index = options.start; index <= options.end; index++) {
    // number configs
    const size = options.size || 90
    const min = options.min || 1
    const max = options.max || 90

    //
    const pfn = new ProvablyFairNumbers(String(index))

    const scaledList = []
    const unscaledList = []
    const undividedList = []
    const rawList = []

    while (scaledList.length < size) {
      const raw = pfn.random()
      let undivided = multiply(raw, Math.pow(2, 256))
      if (options.useBigint) undivided = BigInt(undivided).toString()
      const n = pfn.randomInt(min, max)
      //
      if (!~scaledList.indexOf(n)) {
        scaledList.push(n)
        options.saveUnscaledToFile && unscaledList.push(raw)
        options.saveUndividedToFile && undividedList.push(undivided)
      }
      options.saveRawToFile && rawList.push(raw)

      // change seed with 'nonce'
      pfn.nonce++
    }

    if (!printOnlyNumbers) {
      options.saveScaledToFile && scaledList.unshift(pfn.serverSeed)
      options.saveScaledToFile && scaledList.unshift(pfn.clientSeed)

      options.saveUnscaledToFile && unscaledList.unshift(pfn.serverSeed)
      options.saveUnscaledToFile && unscaledList.unshift(pfn.clientSeed)

      options.saveRawToFile && rawList.unshift(pfn.serverSeed)
      options.saveRawToFile && rawList.unshift(pfn.clientSeed)
    }

    //
    options.saveScaledToFile && chunkScaledLines.push(scaledList.join(' '))
    options.saveUnscaledToFile && chunkUnscaledLines.push(unscaledList.join(' '))
    options.saveUndividedToFile && chunkUndividedLines.push(undividedList.join(' '))
    options.saveRawToFile && chunkRawLines.push(rawList.join(' '))
  }

  logTime && console.timeEnd(qName)

  callback(null, { chunkScaledLines, chunkUnscaledLines, chunkUndividedLines, chunkRawLines })
}
