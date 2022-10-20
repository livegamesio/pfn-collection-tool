#!/usr/bin/env node

const fs = require('fs')
const async = require('async')
const workerFarm = require('worker-farm')

//
const numCPUs = require('os').cpus().length

// Arg
const argv = require('yargs/yargs')(process.argv.slice(2))
  .usage('Usage: $0 [options]')
  .example('$0 -c 100', 'number to be randomly generated')
  //
  .alias('n', 'name')
  .describe('n', 'Output filename')
  .nargs('n', 1)
  .string('n')
  //
  .alias('ps', 'print-seed')
  .describe('ps', 'Print Seed')
  .default('ps', false)
  .boolean('ps')
  //
  .alias('c', 'count')
  .describe('c', 'Total count')
  .demandOption(['c'])
  .number('c')
  //
  .describe('size', 'Size')
  .demandOption(['size'])
  .default('size', 90)
  .number('size')
  //
  .describe('min', 'Minimum ball number')
  .demandOption(['min'])
  .default('min', 1)
  .number('min')
  //
  .describe('max', 'Max ball number')
  .demandOption(['max'])
  .default('max', 90)
  .number('max')
  //
  .alias('k', 'chunk')
  .describe('k', 'Chunk size')
  .demandOption(['k'])
  .default('k', 50)
  .number('k')
  //
  .alias('s', 'save-scaled')
  .describe('s', 'Save scaled numbers to file')
  .demandOption(['s'])
  .default('s', false)
  .boolean('s')
  //
  .alias('u', 'save-unscaled')
  .describe('u', 'Save unscaled numbers to file')
  .demandOption(['u'])
  .default('u', false)
  .boolean('u')
  //
  .alias('r', 'save-raw')
  .describe('r', 'Save raw numbers to file')
  .demandOption(['r'])
  .default('r', false)
  .boolean('r')
  //
  .alias('d', 'save-undivided')
  .describe('d', 'Save undivided numbers to file')
  .demandOption(['d'])
  .default('d', false)
  .boolean('d')
  //
  .describe('use-bigint', 'Save undivided numbers to file')
  .demandOption(['use-bigint'])
  .default('use-bigint', true)
  .boolean('use-bigint')
  //
  .alias('t', 'log-timer')
  .describe('t', 'Log timer')
  .demandOption(['t'])
  .default('t', true)
  .boolean('t')
  //
  .alias('w', 'worker')
  .describe('w', 'Number of worker threads (default: numCPUs / 2)')
  .default('w', Math.ceil(numCPUs / 2))
  //
  .help('h')
  .alias('h', 'help')
  //
  .alias('v', 'version')
  //
  .epilog('LiveGames - PFN Collection Tool')
  .argv

//
const FARM_OPTIONS = {
  maxConcurrentWorkers: argv.worker || (numCPUs / 2), // best performant (numCPUs / 2)
  maxCallsPerWorker: Infinity,
  maxConcurrentCallsPerWorker: 1
}
const pfnWorkers = workerFarm(FARM_OPTIONS, require.resolve('./worker'))

// Config
const logTime = argv.logTimer

const saveScaledToFile = argv.saveScaled // 90 numbers from 1 to 90
const saveUnscaledToFile = argv.saveUnscaled // 90 unscaled numbers from 1 to 90
const saveRawToFile = argv.saveRaw // all unscaled numbers generated to reach (scaled) 90 balls
const saveUndividedToFile = argv.saveUndivided //

const count = argv.count

const size = argv.size
const min = argv.min
const max = argv.max

const printOnlyNumbers = !argv.printSeed
const useBigint = argv.useBigint

let chunkSize = argv.chunk
if (count < chunkSize) chunkSize = count

// ----------------------------------------------------------------------------------------------------
let fileStream
let fileStreamRaw
let fileUnscaledStream
let fileUndividedStream

const outputName = argv.name || Date.now()

console.time('appLifetime')

// folder
if (saveScaledToFile || saveUnscaledToFile || saveRawToFile || saveUndividedToFile) {
  fs.mkdirSync(`./output/${outputName}`, { recursive: true })
}

if (saveScaledToFile) {
  fileStream = fs.createWriteStream(`./output/${outputName}/scaled.txt`, {
    flags: 'a'
  })
}

if (saveUnscaledToFile) {
  fileUnscaledStream = fs.createWriteStream(`./output/${outputName}/unscaled.txt`, {
    flags: 'a'
  })
}

if (saveUndividedToFile) {
  fileUndividedStream = fs.createWriteStream(`./output/${outputName}/undivided.txt`, {
    flags: 'a'
  })
}

if (saveRawToFile) {
  fileStreamRaw = fs.createWriteStream(`./output/${outputName}/raw.txt`, {
    flags: 'a'
  })
}

process.stdin.resume()

const exitHandler = (options, exitCode) => {
  if (options.cleanup) {
    workerFarm.end(pfnWorkers, () => {})
    console.timeEnd('appLifetime')
  }
  // if (exitCode || exitCode === 0) console.log(exitCode)
  if (options.exit) {
    process.exit()
  }
}

// do something when app is closing
process.on('exit', exitHandler.bind(null, { cleanup: true }))

// catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, { exit: true }))

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, { exit: true }))
process.on('SIGUSR2', exitHandler.bind(null, { exit: true }))

// catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, { exit: true }))

//
let workerIndex = 0
let totalProcessed = 0

// Define Write Queue
const q = async.cargo(async (tasks) => {
  //
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    if (saveScaledToFile && task.chunkScaledLines && task.chunkScaledLines.length) {
      await fileStream.write(task.chunkScaledLines.join('\n'))
    }

    if (saveUnscaledToFile && task.chunkUnscaledLines && task.chunkUnscaledLines.length) {
      await fileUnscaledStream.write(task.chunkUnscaledLines.join('\n'))
    }

    if (saveUndividedToFile && task.chunkUndividedLines && task.chunkUndividedLines.length) {
      await fileUndividedStream.write(task.chunkUndividedLines.join('\n'))
    }

    if (saveRawToFile && task.chunkRawLines && task.chunkRawLines.length) {
      await fileStreamRaw.write(task.chunkRawLines.join('\n'))
    }
  }

  if (totalProcessed === workerIndex) process.exit()

  return true
  //
}, numCPUs)

// assign an error callback
q.error(function (err, task) {
  console.error('task experienced an error', err, task)
})

// bind workers
for (workerIndex = 0; workerIndex < Math.ceil(count / chunkSize); workerIndex++) {
  const start = workerIndex * chunkSize
  let end = start + chunkSize
  if (end > count) end = count

  const taskOptions = {
    start,
    end,
    logTime,
    useBigint,
    size,
    min,
    max,
    saveScaledToFile,
    saveRawToFile,
    saveUnscaledToFile,
    saveUndividedToFile,
    printOnlyNumbers
  }

  pfnWorkers(taskOptions, (err, response) => {
    if (err) console.log(err)

    totalProcessed++

    q.push(response, function (qErr) {
      if (qErr) console.log(qErr)
      // else console.log('finished processing', taskOptions)
    })
  })

  //
}

console.log(`${workerIndex} workers added to pool..`)
