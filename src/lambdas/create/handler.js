/* Coldstart dependency loading */
const { formatResponse } = require('../../utils/response')
const { DynamoDBClient, PutItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb')
const { marshall } = require('@aws-sdk/util-dynamodb')
const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION })
const { v4: uuidv4 } = require('uuid')
const argon2 = require('argon2')
const { string, object } = require('yup')

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

  if (!await inputSchema.validate(body)) {
    console.log('Could not validate input.')
    return callback(null, formatResponse({ error: `Invalid Input. Please enter a valid email, username (Less than ${usernameMaxLength} characters), and password.` }, 409))
  } else console.log('Input Successfully Validated.')

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
    var passwordHash = await argon2.hash(body.password)
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
      createdOn: { S: +new Date() }
    }
  }

  // Insert into DynamoDB
  try {
    const putCommand = new PutItemCommand({ TableName: process.env.DYNAMO_TABLE_NAME, Item: dbInput })
    await dbClient.send(putCommand)
    console.log(`Successfully added user ${body.username} to database.`)
  } catch (error) {
    console.log(`Error when adding user to database :: ${error}.`)
    return callback(null, formatResponse({ error: 'Internal Service Error.' }, 500))
  }

  // Form Response
  const data = {
    status: 'Successfully created user!'
  }

  // Send response
  return callback(null, formatResponse(data))
}
