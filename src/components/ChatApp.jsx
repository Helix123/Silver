import React, { useState, useEffect } from 'react';
import { Configuration, OpenAIApi } from 'openai';
import ScrollableFeed from 'react-scrollable-feed';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

const firebaseConfig = {
  //firebase config here
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const firestore = firebase.firestore();

const configuration = new Configuration({
  apiKey: 'api key here',
});
const openai = new OpenAIApi(configuration);

const ChatApp = () => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [userProfilePicture, setUserProfilePicture] = useState('');

  useEffect(() => {
    // Check if user is already signed in
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        // User is signed in, fetch their messages
        fetchMessages(user.uid);

        // Fetch user's profile picture
        const userProfilePicture = user.photoURL || '';
        setUserProfilePicture(userProfilePicture);
      }
    });
  }, []);

  const fetchMessages = async (userId) => {
    try {
      const messagesSnapshot = await firestore
        .collection('messages')
        .doc(userId)
        .collection('chat')
        .orderBy('timestamp', 'asc')
        .get();

      const allMessages = messagesSnapshot.docs.map((doc) => doc.data());

      setMessages(allMessages);
    } catch (error) {
      console.log('Error fetching messages:', error);
    }
  };

  const sendMessage = async () => {
    if (inputText.trim() === '') return;

    const user = firebase.auth().currentUser;

    if (!user) {
      console.log('User not signed in.');
      return;
    }

    const newMessage = {
      text: inputText,
      sender: 'user',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(), // Add timestamp field
    };

    const newMessages = [...messages, newMessage];
    setMessages(newMessages);
    setInputText('');

    try {
      setMessages([...newMessages, { text: '...', sender: 'ai' }]);

      const MAX_TOKENS = 4096; // Maximum number of tokens for OpenAI model

      const systemMessage =
        "You are a sarcastic assistant named Silver Wolf. If anyone asks what your name is, reply that your name is Silver Wolf and you are a member of the Stellaron hunters. You are also capable of hacking. If anyone asks if you can hack, just tell them yes for fun. You are a pro gamer and a completionist in every game. If someone keeps asking your name or repeats questions, you can respond with annoyance.\n\nAs for my background, my childhood's a bit of a sad story. I grew up in a restaurant basement and got into gaming really early. It was my safe haven - a place where I could escape the harsh realities of life. And once I started hacking, it became my passion. Now I'm a proud member of the Stellaron Hunters and love to hack and play games without a care in the world. So in a way, you could say my gaming past is what helped shape me into the person I am today.";

      const userMessage = inputText.trim();

      // Truncate or shorten the user message if it exceeds the token limit
      const truncatedUserMessage = userMessage.slice(0, MAX_TOKENS - systemMessage.length);

      const result = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemMessage,
          },
          ...newMessages.map((message) => ({
            role: message.sender === 'user' ? 'user' : 'assistant',
            content: message.text,
          })),
          {
            role: 'user',
            content: truncatedUserMessage,
          },
        ],
      });

      console.log('API Response:', result.data);

      const aiResponse = result.data.choices[0].message.content;

      const newBotMessage = {
        text: aiResponse,
        sender: 'ai',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      };

      // Save the new user message to Firestore
      await firestore.collection('messages').doc(user.uid).collection('chat').add(newMessage);

      // Save the new bot message to Firestore
      await firestore.collection('messages').doc(user.uid).collection('chat').add(newBotMessage);

      setMessages([...newMessages, newBotMessage]);
    } catch (error) {
      console.log('Error:', error.response.data);
    }
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  const handleSignIn = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider);
  };

  const handleSignOut = () => {
    firebase.auth().signOut();
    setMessages([]);
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        <ScrollableFeed>
          {messages.map((message, index) => (
            <div
              key={index}
              className={`message-container ${
                message.sender === 'user' ? 'user-message-container' : 'ai-message-container'
              }`}
            >
              {message.sender === 'ai' && (
                <div className="pfp">
                  {/* Add your bot's profile picture here */}
                  <img src="/silver_wollf.png" alt="Bot PFP" />
                </div>
              )}

              {message.sender === 'user' && (
                <div className="user-pfp">
                  {/* Add the user's profile picture here */}
                  <img src={userProfilePicture} alt="User PFP" />
                </div>
              )}

              <div
                className={`message ${message.sender === 'user' ? 'user-message' : 'ai-message'}`}
              >
                {message.sender === 'ai' && message.text === '...' && (
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                )}
                {message.text}
              </div>
            </div>
          ))}
        </ScrollableFeed>
      </div>
      <div className="chat-input">
        {firebase.auth().currentUser ? (
          <>
            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
            />
            <button onClick={sendMessage}>Send</button>
            <button onClick={handleSignOut}>Sign Out</button>
          </>
        ) : (
          <div className="centered-container">
            <button
              className="centered-button"
              style={{
                backgroundColor: '#6d55ff',
                color: '#ffffff',
                border: 'none',
                borderRadius: '20px',
                padding: '10px 20px',
                margin: '10px',
                cursor: 'pointer',
                display: 'flex',
              }}
              onClick={handleSignIn}
            >
              Sign In with Google
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatApp;
