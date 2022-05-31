using UnityEngine;
using NativeWebSocket;

public class WebSocketService : MonoBehaviour
{
   private StatusController _statusController = null;

   public const string RequestStartOp = "1";
   public const string PlayingOp = "11";
   public const string HitOp = "5";
   public const string YouWonOp = "91";
   public const string YouLostOp = "92";



   private bool intentionalClose = false;
   private WebSocket _websocket;
   private string _webSocketDns = "wss://5bsef490o5.execute-api.us-east-1.amazonaws.com/production";

   // Establishes the connection's lifecycle callbacks.
   private void SetupWebsocketCallbacks()
   {
      _websocket.OnOpen += () =>
      {
         Debug.Log("Connection open!");
         intentionalClose = false;
         GameMessage startRequest = new GameMessage("OnMessage", RequestStartOp);
         SendWebSocketMessage(JsonUtility.ToJson(startRequest));
      };

      _websocket.OnError += (e) =>
      {
         Debug.Log("Error! " + e);
      };

      _websocket.OnClose += (e) =>
      {
         Debug.Log("Connection closed!");

      };

      _websocket.OnMessage += (bytes) =>
      {
         Debug.Log("OnMessage!");
         string message = System.Text.Encoding.UTF8.GetString(bytes);
         Debug.Log(message.ToString());

         ProcessReceivedMessage(message);
      };
   }

  
   async public void FindMatch()
   {
      
      await _websocket.Connect();
   }

   private void ProcessReceivedMessage(string message)
   {

      GameMessage gameMessage = JsonUtility.FromJson<GameMessage>(message);
      

      if (gameMessage.opcode == PlayingOp)
      {
         _statusController.SetText(StatusController.Playing);
      }
      else if (gameMessage.opcode == HitOp)
      {
         Debug.Log(gameMessage.message);
      }
      else if (gameMessage.opcode == YouWonOp)
      {
         _statusController.SetText(StatusController.YouWon);
         QuitGame();
      }
      else if (gameMessage.opcode == YouLostOp)
      {
         _statusController.SetText(StatusController.YouLost);
         QuitGame();
      }
   }

   public async void SendWebSocketMessage(string message)
   {
      if (_websocket.State == WebSocketState.Open)
      {
         await _websocket.SendText(message);
      }
   }

   public async void QuitGame()
   {
      intentionalClose = true;
      await _websocket.Close();
   }

   private async void OnApplicationQuit()
   {
      await _websocket.Close();
   }

   void Start()
   {
      Debug.Log("Websocket start");
      intentionalClose = false;
      _statusController = FindObjectOfType<StatusController>();

      _websocket = new WebSocket(_webSocketDns);
      SetupWebsocketCallbacks();
      FindMatch();
   }

   void Update()
   {
#if !UNITY_WEBGL || UNITY_EDITOR
      _websocket.DispatchMessageQueue();
#endif
   }

   public void init() { }

   protected WebSocketService() { }
}


