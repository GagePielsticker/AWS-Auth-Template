const { formatResponse } = require('./response')

test('Testing formatResponse 200 code on data', () => {
  const res = formatResponse({ test: 1 })

  expect(res.statusCode).toBe(200)
})

test('Testing custom response codes', () => {
  const res = formatResponse({ test: 1 }, 500)

  expect(res.statusCode).toBe(500)
})
