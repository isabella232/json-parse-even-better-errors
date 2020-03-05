'use strict'

const t = require('tap')

const parseJson = require('..')

t.test('parses JSON', t => {
  const data = JSON.stringify({
    foo: 1,
    bar: {
      baz: [1, 2, 3, 'four']
    }
  })
  t.deepEqual(parseJson(data), JSON.parse(data), 'does the same thing')
  t.done()
})

t.test('parses JSON if it is a Buffer, removing BOM bytes', t => {
  const str = JSON.stringify({
    foo: 1,
    bar: {
      baz: [1, 2, 3, 'four']
    }
  })
  const data = Buffer.from(str)
  const bom = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), data])
  t.deepEqual(parseJson(data), JSON.parse(str))
  t.deepEqual(parseJson(bom), JSON.parse(str), 'strips the byte order marker')
  t.end()
})

t.test('better errors when faced with \\b and other malarky', t => {
  const str = JSON.stringify({
    foo: 1,
    bar: {
      baz: [1, 2, 3, 'four']
    }
  })
  const data = Buffer.from(str)
  const bombom = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF, 0xEF, 0xBB, 0xBF]), data])
  t.throws(() => parseJson(bombom), {
    message: /\(0xFEFF\) in JSON at position 0/
  }, 'only strips a single BOM, not multiple')
  const bs = str + '\b\b\b\b\b\b\b\b\b\b\b\b'
  t.throws(() => parseJson(bs), {
    message: /^Unexpected token "\\b" \(0x08\) in JSON at position.*\\b"$/
  })
  t.end()
})

t.test('throws SyntaxError for unexpected token', t => {
  const data = 'foo'
  t.throws(
    () => parseJson(data),
    {
      message: 'Unexpected token "o" (0x6F) in JSON at position 1 while parsing "foo"',
      code: 'EJSONPARSE',
      position: 1,
      name: 'JSONParseError',
      systemError: SyntaxError
    }
  )
  t.done()
})

t.test('throws SyntaxError for unexpected end of JSON', t => {
  const data = '{"foo: bar}'
  t.throws(
    () => parseJson(data),
    {
      message: 'Unexpected end of JSON input while parsing "{\\\"foo: bar}"',
      code: 'EJSONPARSE',
      position: 10,
      name: 'JSONParseError',
      systemError: SyntaxError
    }
  )
  t.done()
})

t.test('throws SyntaxError for unexpected number', t => {
  const data = '[[1,2],{3,3,3,3,3}]'
  t.throws(
    () => parseJson(data),
    {
      message: 'Unexpected number in JSON at position 8',
      code: 'EJSONPARSE',
      position: 0,
      name: 'JSONParseError',
      systemError: SyntaxError
    }
  )
  t.done()
})

t.test('SyntaxError with less context (limited start)', t => {
  const data = '{"6543210'
  t.throws(
    () => parseJson(data, null, 3),
    {
      message: 'Unexpected end of JSON input while parsing near "...3210"',
      code: 'EJSONPARSE',
      position: 8,
      name: 'JSONParseError',
      systemError: SyntaxError
    })
  t.done()
})

t.test('SyntaxError with less context (limited end)', t => {
  const data = 'abcde'
  t.throws(
    () => parseJson(data, null, 2),
    {
      message: 'Unexpected token "a" \(0x61\) in JSON at position 0 while parsing near "ab..."',
      code: 'EJSONPARSE',
      position: 0,
      name: 'JSONParseError',
      systemError: SyntaxError
    }
  )
  t.done()
})

t.test('throws TypeError for undefined', t => {
  t.throws(
    () => parseJson(undefined),
    new TypeError('Cannot parse undefined')
  )
  t.done()
})

t.test('throws TypeError for non-strings', t => {
  t.throws(
    () => parseJson(new Map()),
    new TypeError('Cannot parse [object Map]')
  )
  t.done()
})

t.test('throws TypeError for empty arrays', t => {
  t.throws(
    () => parseJson([]),
    new TypeError('Cannot parse an empty array')
  )
  t.done()
})

t.test('handles empty string helpfully', t => {
  t.throws(() => parseJson(''), {
    message: 'Unexpected end of JSON input while parsing empty string',
    name: 'JSONParseError',
    position: 0,
    code: 'EJSONPARSE',
    systemError: SyntaxError
  })
  t.end()
})

t.test('json parse error class', t => {
  t.isa(parseJson.JSONParseError, 'function')
  // we already checked all the various index checking logic above
  const poop = new Error('poop')
  const fooShouldNotShowUpInStackTrace = () => {
    return new parseJson.JSONParseError(poop, 'this is some json', undefined, bar)
  }
  const bar = () => fooShouldNotShowUpInStackTrace()
  const err1 = bar()
  t.equal(err1.systemError, poop, 'gets the original error attached')
  t.equal(err1.position, 0)
  t.equal(err1.message, `poop while parsing 'this is some json'`)
  t.equal(err1.name, 'JSONParseError')
  err1.name = 'something else'
  t.equal(err1.name, 'JSONParseError')
  t.notMatch(err1.stack, /fooShouldNotShowUpInStackTrace/)
  // calling it directly, tho, it does
  const fooShouldShowUpInStackTrace = () => {
    return new parseJson.JSONParseError(poop, 'this is some json')
  }
  const err2 = fooShouldShowUpInStackTrace()
  t.equal(err2.systemError, poop, 'gets the original error attached')
  t.equal(err2.position, 0)
  t.equal(err2.message, `poop while parsing 'this is some json'`)
  t.match(err2.stack, /fooShouldShowUpInStackTrace/)

  t.end()
})

t.test('parse without exception', t => {
  const bad = 'this is not json'
  t.equal(parseJson.noExceptions(bad), undefined, 'does not throw')
  const obj = { this: 'is json' }
  const good = JSON.stringify(obj)
  t.deepEqual(parseJson.noExceptions(good), obj, 'parses json string')
  const buf = Buffer.from(good)
  t.deepEqual(parseJson.noExceptions(buf), obj, 'parses json buffer')
  const bom = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), buf])
  t.deepEqual(parseJson.noExceptions(bom), obj, 'parses json buffer with bom')
  t.end()
})
