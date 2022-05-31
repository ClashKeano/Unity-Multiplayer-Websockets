const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();
require('./connect-patch.js');
let send = undefined;
const TABLE_NAME = "game-session";

function init(event) {
   const apigwManagementApi = new AWS.ApiGatewayManagementApi({
      apiVersion: '2018-11-29',
      endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
   });
   send = async (connectionId, data) => {
      await apigwManagementApi.postToConnection({
         ConnectionId: connectionId,
         Data: `${data}`
      }).promise();
   }
}

function getAvailableGameSession() {
   return ddb.scan({
      TableName: TABLE_NAME,
      FilterExpression: "#p2 = :empty and #status <> :closed",
      ExpressionAttributeNames: {
         "#p2": "player2",
         "#status": "gameStatus"
      },
      ExpressionAttributeValues: {
         ":empty": "empty",
         ":closed": "closed"
      }
   }).promise();
}

function addConnectionId(connectionId) {
   return getAvailableGameSession().then((data) => {
      console.log("Game session data: %j", data);

      if (data && data.Count < 1) {
         // Create new game session 
         console.log("Creating new game session...");

         return ddb.put({
            TableName: TABLE_NAME,
            Item: {
               uuid: Date.now() + '',
               player1: connectionId,
               player2: "empty"
            },
         }).promise();
      } else {
         // Add player to existing session as player 2
         console.log("Adding player2 to existing session");

         return ddb.update({
            TableName: TABLE_NAME,
            Key: {
               "uuid": data.Items[0].uuid
            },
            UpdateExpression: "set player2 = :p2",
            ExpressionAttributeValues: {
               ":p2": connectionId
            }
         });
      }
   });
}

exports.handler = (event, context, callback) => {
   const connectionId = event.requestContext.connectionId;
   console.log("Connect event received: %j", event);
   init(event);

   addConnectionId(connectionId).then(() => {
      callback(null, {
         statusCode: 200
      });
   });
}