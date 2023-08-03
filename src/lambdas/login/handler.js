/* Coldstart dependency loading */
const { formatResponse } = require('../../utils/response')

const { DynamoDBClient, QueryCommand } = require('@aws-sdk/client-dynamodb')
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')
const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION })

const { string, object } = require('yup')

const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

/* Invoke handler */
exports.handler = async (event, context, callback) => {
  const params = event?.queryStringParameters
  const body = JSON.parse(event.body)
  console.log(`Lambda Invoked with params:\n${params ? JSON.stringify(params, null, 4) : 'NONE'}`)

  // Input Validation
  const inputSchema = object({
    email: string().email(),
    password: string()
  })

  try {
    await inputSchema.validate(body)
  } catch (error) {
    console.log(`Error validating input :: ${error}.`)
    return callback(null, formatResponse({ error: `Invalid Input. ${error}` }, 409))
  }

  body.email = body.email.toLowerCase() // Change our email to lowercase since we check against it for pre-existing users

  // Get user from database
  const dbQuery = {
    TableName: process.env.DYNAMO_TABLE_NAME,
    IndexName: process.env.USER_INDEX,
    KeyConditionExpression: 'email = :email',
    ExpressionAttributeValues: marshall({
      ':email': body.email
    })
  }

  try {
    const queryCommand = new QueryCommand(dbQuery)
    const queryResponse = await dbClient.send(queryCommand)

    if (queryResponse.Items && queryResponse.Items.length > 0) {
      var userObject = unmarshall(queryResponse.Items[0])
      console.log('Found email in database.')
    } else {
      return callback(null, formatResponse({ error: 'No user with that email/password combination exist.' }, 403))
    }
  } catch (error) {
    console.log(`Error checking user in database:: ${error}.`)
    return callback(null, formatResponse({ error: 'Internal Service Error.' }, 500))
  }

  // Validate Password Is Correct
  try {
    const bcryptResult = bcrypt.compareSync(body.password, userObject.password)
    if (!bcryptResult) return callback(null, formatResponse({ error: 'No user with that email/password combination exist.' }, 403))
    console.log('validated Password.')
  } catch (error) {
    console.log(`Error checking password:: ${error}.`)
    return callback(null, formatResponse({ error: 'Internal Service Error' }, 500))
  }

  // Create JWT
  try {
    var userToken = jwt.sign(
      {
        userid: userObject.userid,
        email: userObject.email
      },
      process.env.JWT_KEY, // Random string our app will encrypt/decrypt jwt with. Technically sensitive so should be in secrets manager and auto-rotate.
      {
        expiresIn: process.env.JWT_EXPIRY
      }
    )
    console.log('Successfully generated JWT.')
  } catch (error) {
    console.log(`Error when generating JWT :: ${error}.`)
    return callback(null, formatResponse({ error: 'Internal Service Error.' }, 500))
  }

  // Return data
  const data = {
    status: 'Successfully logged in.',
    jwt: `${userToken}`
  }

  return callback(null, formatResponse(data))
}
