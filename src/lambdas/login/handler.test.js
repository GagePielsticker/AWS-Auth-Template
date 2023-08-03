const { handler } = require('./handler')
process.env.AWS_REGION = 'us-east-1'

test('Testing bye handler 200 response', () => {
  const result = handler({}, null, processResult)

  function processResult (err, data) {
    expect(data.statusCode).toBe(200)
  }
})
