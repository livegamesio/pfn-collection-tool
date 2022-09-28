#!/usr/bin/env node

const fs = require('fs')
const async = require('async')

const workerFarm = require('worker-farm')

//
const numCPUs = require('os').cpus().length

//
const FARM_OPTIONS = {
  maxConcurrentWorkers: numCPUs / 2, // best performant
  maxCallsPerWorker: Infinity,
  maxConcurrentCallsPerWorker: 1
}
const pfnWorkers = workerFarm(FARM_OPTIONS, require.resolve('./worker'))

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
  .alias('c', 'count')
  .describe('c', 'Total count')
  .demandOption(['c'])
  .number('c')
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
  .default('s', true)
  .boolean('s')
  //
  .alias('u', 'save-unscaled')
  .describe('u', 'Save unscaled numbers to file')
  .demandOption(['u'])
  .default('u', true)
  .boolean('u')
  //
  .alias('r', 'save-raw')
  .describe('r', 'Save raw numbers to file')
  .demandOption(['r'])
  .default('r', true)
  .boolean('r')
  //
  .alias('t', 'log-timer')
  .describe('t', 'Log timer')
  .demandOption(['t'])
  .default('t', true)
  .boolean('t')
  //
  .help('h')
  .alias('h', 'help')
  //
  .alias('v', 'version')
  //
  .epilog('LiveGames - PFN Collection Tool')
  .argv

// Config
const logTime = argv.logTimer

const saveScaledToFile = argv.saveScaled // 90 numbers from 1 to 90
const saveUnscaledToFile = argv.saveUnscaled // 90 unscaled numbers from 1 to 90
const saveRawToFile = argv.saveRaw // all unscaled numbers generated to reach (scaled) 90 balls

const count = argv.count

let chunkSize = argv.chunk
if (count < chunkSize) chunkSize = count

// ----------------------------------------------------------------------------------------------------

//
let fileStream
let fileStreamRaw
let fileUnscaledStream

const outputName = argv.name || Date.now()

console.time('appLifetime')

// folder
if (saveScaledToFile || saveUnscaledToFile || saveRawToFile) {
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

    if (saveRawToFile && task.chunkRawLines && task.chunkRawLines.length) {
      await fileStreamRaw.write(task.chunkRawLines.join('\n'))
    }
  }

  if (totalProcessed === workerIndex) process.exit()

  return true
  //
}, 10)

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
    saveScaledToFile,
    saveRawToFile,
    saveUnscaledToFile
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
