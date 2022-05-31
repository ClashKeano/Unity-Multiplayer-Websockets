const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();
require('./message-patch.js');
let send = undefined;
const TABLE_NAME = "game-session";
const REQUEST_START_OP = "1";
const HIT_OP = "5";
const KO_OP = "9";
const YOU_WON = "91";
const YOU_LOST = "92";


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
   };
}

function getGameSession(playerId) {
   return ddb.scan({
      TableName: TABLE_NAME,
      FilterExpression: "#p1 = :playerId or #p2 = :playerId",
      ExpressionAttributeNames: {
         "#p1": "player1",
         "#p2": "player2"
      },
      ExpressionAttributeValues: {
         ":playerId": playerId
      }
   }).promise();
}

exports.handler = (event, context, callback) => {
   console.log("Event received: %j", event);
   init(event);

   let message = JSON.parse(event.body);
   console.log("message: %j", message);

   let connectionIdForCurrentRequest = event.requestContext.connectionId;
   console.log("Current connection id: " + connectionIdForCurrentRequest);

   if (message && message.opcode) {

      switch (message.opcode) {
         case REQUEST_START_OP:
            console.log("Opcode 1: Request Game Start");

            getGameSession(connectionIdForCurrentRequest).then((data) => {
               console.log("getGameSession: " + data.Items[0].uuid);

               send(connectionIdForCurrentRequest, '{ "uuid": ' + data.Items[0].uuid + ', "opcode": ' +
               REQUEST_START_OP + ' }');
            });

            break;

         case HIT_OP: // Send player hit, reduce health bar on Unity end
            console.log("Opcode 5: Player hit");

            getGameSession(connectionIdForCurrentRequest).then((data) => {
               console.log("getGameSession: %j", data.Items[0]);

               var sendToConnectionId = connectionIdForCurrentRequest;
               if (data.Items[0].player1 == connectionIdForCurrentRequest) {
                  // request came from player1, just send out to player2
                  sendToConnectionId = data.Items[0].player2;
               } else {
                  // request came from player2, just send out to player1
                  sendToConnectionId = data.Items[0].player1;
               }

               console.log("Sending player hit message to: " + sendToConnectionId);
               send(sendToConnectionId, '{ "uuid": ' + data.Items[0].uuid + ', "opcode": ' +
                  HIT_OP + ', "message": "other player caused damage" }');
            });

            break;

         case KO_OP: // Send game over
            console.log("Opcode 9: Player KO, Game Over");

            getGameSession(connectionIdForCurrentRequest).then((data) => {
               console.log("getGameSession: %j", data.Items[0]);

               if (data.Items[0].player1 == connectionIdForCurrentRequest) {
                  // Player1 was the winner
                  send(data.Items[0].player1, '{ "opcode": ' + YOU_WON + ' }');
                  send(data.Items[0].player2, '{ "opcode": ' + YOU_LOST + ' }');
               } else {
                  // Player2 was the winner
                  send(data.Items[0].player1, '{ "opcode": ' + YOU_LOST + ' }');
                  send(data.Items[0].player2, '{ "opcode": ' + YOU_WON + ' }');
               }
            });

         default:
            // No default case
      }
   }

   return callback(null, {
      statusCode: 200,
   });
};