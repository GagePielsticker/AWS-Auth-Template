/* Coldstart dependency loading */
const { formatResponse } = require('../../utils/response')

const { DynamoDBClient, PutItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb')
const { marshall } = require('@aws-sdk/util-dynamodb')
const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION })

const { v4: uuidv4 } = require('uuid')
const bcrypt = require('bcryptjs')
const { string, object } = require('yup')

const jwt = require('jsonwebtoken')

/* Invoke handler */
exports.handler = async (event, context, callback) => {
  const params = event?.queryStringParameters
  const body = JSON.parse(event.body)
  console.log(`Lambda Invoked with params:\n${params ? JSON.stringify(params, null, 4) : 'NONE'}`)

  // Input Validation
  const usernameMaxLength = 20

  const inputSchema = object({
    email: string().email(),
    username: string().max(20),
    password: string()
  })

  try {
    await inputSchema.validate(body)
  } catch (error) {
    console.log(`Error validating input :: ${error}.`)
    return callback(null, formatResponse({ error: `Invalid Input. ${error}` }, 409))
  }

  body.email = body.email.toLowerCase() // Change our email to lowercase since we check against it for pre-existing users

  // Validate email doesnt already exist in database
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
      return callback(null, formatResponse({ error: 'User with this email already exist.' }, 409))
    }
  } catch (error) {
    console.log(`Error checking user in database:: ${error}.`)
    return callback(null, formatResponse({ error: 'Internal Service Error.' }, 500))
  }

  // Hash our password
  try {
    var passwordHash = await bcrypt.hash(body.password, 10)
    console.log('Password Successfully Hashed.')
  } catch (error) {
    console.log(`Error hashing password :: ${error}.`)
    return callback(null, formatResponse({ error: 'Internal Service Error.' }, 500))
  }

  // Create DynamoDB Object
  const dbInput = {
    TableName: process.env.DYNAMO_TABLE_NAME,
    Item: {
      userid: { S: uuidv4() }, // primary key (unchangeable)
      email: { S: body.email }, // secondary index key
      username: { S: body.username },
      password: { S: passwordHash },
      createdOn: { N: `${+new Date()}` } // You must send numbers to Dynamo as strings, however dynamo will treat it as a number for maths
    }
  }

  // Insert into DynamoDB
  try {
    const putCommand = new PutItemCommand(dbInput)
    await dbClient.send(putCommand)
    console.log(`Successfully added user ${body.username} to database.`)
  } catch (error) {
    console.log(`Error when adding user to database :: ${error}.`)
    return callback(null, formatResponse({ error: 'Internal Service Error.' }, 500))
  }

  // Generate our JWT to send to the user
  try {
    var userToken = jwt.sign(
      {
        userid: dbInput.Item.userid.S,
        email: dbInput.Item.email.S
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

  // Form Response
  const data = {
    status: 'Successfully created user!',
    jwt: `${userToken}`
  }

  // Send response
  return callback(null, formatResponse(data))
}
