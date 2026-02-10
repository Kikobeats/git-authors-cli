'use strict'

const { styleText } = require('node:util')

const gray = str => styleText('gray', str)

const white = str => styleText('white', str)

const red = str => styleText('red', str)

module.exports = { gray, white, red }
