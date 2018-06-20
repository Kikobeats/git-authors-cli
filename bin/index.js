#!/usr/bin/env node
'use strict'

const existsFile = require('exists-file')
const jsonFuture = require('json-future')
const execa = require('execa')
const chalk = require('chalk')

require('update-notifier')({ pkg: require('../package.json') }).notify()

const TTY = process.platform === 'win32' ? 'CON' : '/dev/tty'

const throwError = err => {
  const message = chalk.red(err.message || err)
  console.log(message)
  process.exit(1)
}

const cli = require('meow')({
  pkg: require('../package.json'),
  help: require('./help'),
  flags: {
    cwd: {
      type: 'string',
      default: process.cwd()
    },
    print: {
      type: 'boolean',
      default: true
    },
    save: {
      type: 'boolean',
      default: true
    }
  }
})

const loadPkg = path => {
  try {
    return jsonFuture.loadAsync(path)
  } catch (err) {
    return null
  }
}

const renderContributors = contributors => {
  console.log()
  contributors.forEach(({ author, commits, name, email }) => {
    const prettyAuthor = chalk.gray(author.replace(name, chalk.white(name)))
    const prettyCommits = chalk.white(commits)
    console.log(`  ${prettyCommits}\t${prettyAuthor}`)
  })
}
const { print, cwd, save } = cli.flags
;(async () => {
  try {
    if (!await existsFile('.git')) { return throwError({ message: 'Ops, not git directory detected!' }) }
    const { stdout, stderr } = await execa.shell(`git shortlog -sne < ${TTY}`, {
      cwd
    })
    if (stderr) return throwError(stderr)

    const contributors = stdout.split('\n').reduce((acc, line) => {
      const [commits, author] = line.split('\t')
      const [name, email] = author.split('<')
      return acc.concat({
        commits: Number(commits.trim()),
        author,
        name,
        email: email.replace('>', '')
      })
    }, [])

    if (print) renderContributors(contributors)
    const pkg = await loadPkg(`${cwd}/package.json`)

    if (pkg && save) {
      const authors = contributors.map(contributors => contributors.author)
      const newPkg = { ...pkg, contributors: authors }
      await jsonFuture.saveAsync(`${cwd}/package.json`, newPkg)
      if (print) {
        console.log(
          `\n  ${chalk.gray(`Added into ${chalk.white('package.json')} ✨`)}`
        )
      }
    }
  } catch (err) {
    throwError(err)
  }
})()
