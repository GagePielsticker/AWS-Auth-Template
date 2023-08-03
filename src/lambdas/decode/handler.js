/* Coldstart dependency loading */
const { formatResponse } = require('../../utils/response')
const { string, object } = require('yup')
const jwt = require('jsonwebtoken')

/* Invoke handler */
exports.handler = async (event, context, callback) => {
  const params = event?.queryStringParameters
  const body = JSON.parse(event.body)
  console.log(`Lambda Invoked with params:\n${params ? JSON.stringify(params, null, 4) : 'NONE'}`)

  // Input Validation
  const inputSchema = object({
    jwt: string()
  })

  try {
    await inputSchema.validate(body)
  } catch (error) {
    console.log(`Error validating input :: ${error}.`)
    return callback(null, formatResponse({ error: `Invalid Input. ${error}` }, 409))
  }

  // Decode our JWT
  try {
    var decodedToken = jwt.verify(body.jwt, process.env.JWT_KEY)
  } catch (error) {
    console.log(`Invalid JWT :: ${error}`)
    return callback(null, formatResponse({ error: 'Could not validate JWT token.' }, 403))
  }

  // Return data
  const data = {
    status: 'Successfully validated JWT.',
    ...decodedToken
  }

  return callback(null, formatResponse(data))
}
