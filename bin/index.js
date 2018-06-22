#!/usr/bin/env node
'use strict'

const existsFile = require('exists-file')
const jsonFuture = require('json-future')
const execa = require('execa')
const chalk = require('chalk')
const { EOL } = require('os')
const path = require('path')

const rootPkg = require('../package.json')

require('update-notifier')({ pkg: rootPkg }).notify()

const TTY = process.platform === 'win32' ? 'CON' : '/dev/tty'

const BLACKLIST_KEYWORDS = ['greenkeeper', 'noreply', '\\bbot\\b']

const REGEX_BLACKLIST_KEYWORDS = new RegExp(BLACKLIST_KEYWORDS.join('|'), 'i')

const REGEX_EMAIL_VARIATIONS = /[.+]/g

const normalizeEmail = email =>
  email.toLowerCase().replace(REGEX_EMAIL_VARIATIONS, '')

const isSameEmail = (email1, email2) =>
  normalizeEmail(email1) === normalizeEmail(email2)

const processError = err => {
  console.log(chalk.red(err.message || err))
  process.exit(1)
}

const cli = require('meow')({
  pkg: rootPkg,
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
;(async () => {
  try {
    if (!await existsFile('.git')) {
      return processError({
        message: 'Ops, not git directory detected!'
      })
    }

    const { print, cwd, save } = cli.flags
    const pkgPath = path.join(cwd, 'package.json')
    const cmd = `git shortlog -sne < ${TTY}`
    const { stdout, stderr } = await execa.shell(cmd, { cwd })

    if (stderr) return processError(stderr)

    const contributors = stdout
      .split(EOL)
      .reduce((acc, line) => {
        const [commits, author] = line.split('\t')
        const [name, email] = author.split('<')
        return acc.concat({
          author,
          commits: Number(commits.trim()),
          email: email.replace('>', ''),
          name
        })
      }, [])
      .reduce((acc, contributor, indexContributor, contributors) => {
        const index = acc.findIndex(({ email }) =>
          isSameEmail(email, contributor.email)
        )
        const isPresent = index !== -1
        if (!isPresent) return acc.concat(contributor)
        acc[index].commits += contributor.commits
        return acc
      }, [])
      .filter(({ author }) => !REGEX_BLACKLIST_KEYWORDS.test(author))
      .sort((c1, c2) => c2.commits - c1.commits)

    if (print) renderContributors(contributors)
    const pkg = await loadPkg(pkgPath)

    if (pkg && save) {
      const authors = contributors.map(contributors => contributors.author)
      const newPkg = { ...pkg, contributors: authors }
      await jsonFuture.saveAsync(pkgPath, newPkg)
      if (print) {
        console.log(
          `\n  ${chalk.gray(`Added into ${chalk.white('package.json')} ✨`)}`
        )
      }
    }
  } catch (err) {
    processError(err)
  }
})()
