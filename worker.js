'use strict'
const { ProvablyFairNumbers } = require('pfn')

module.exports = function (options, callback) {
  const printOnlyNumbers = false
  const logTime = ('logTime' in options) ? options.logTime : false

  const chunkScaledLines = []
  const chunkUnscaledLines = []
  const chunkRawLines = []

  const qName = `chunk-${options.start}-${options.end}`
  logTime && console.time(qName)

  //
  for (let index = options.start; index <= options.end; index++) {
    // number configs
    const size = 90
    const min = 1
    const max = 90

    //
    const pfn = new ProvablyFairNumbers(String(index))

    const scaledList = []
    const unscaledList = []
    const rawList = []

    while (scaledList.length < size) {
      const raw = pfn.random()
      const n = pfn.randomInt(min, max)
      //
      if (!~scaledList.indexOf(n)) {
        scaledList.push(n)
        options.saveUnscaledToFile && unscaledList.push(raw)
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
    options.saveRawToFile && chunkRawLines.push(rawList.join(' '))
  }

  logTime && console.timeEnd(qName)

  callback(null, { chunkScaledLines, chunkUnscaledLines, chunkRawLines })
}
