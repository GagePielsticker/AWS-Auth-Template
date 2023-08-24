
function formatResponse (data, stat) {
  let statusCode

  if (!stat) statusCode = 200
  else statusCode = stat

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin':'*'
    },
    body: JSON.stringify(
      {
        region: process.env.AWS_REGION,
        data
      }
    )
  }
}

module.exports = {
  formatResponse
}
