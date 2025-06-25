// src/app/components/ChatAna.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import chatStyles from './ChatAna.module.css';

const ChatAna = () => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [chats, setChats] = useState([{ id: 1, messages: [], input: '' }]);
  const [activeChatId, setActiveChatId] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleAddChat = useCallback(() => {
    const newChatId =
      chats.length > 0 ? Math.max(...chats.map((c) => c.id)) + 1 : 1;
    setChats((prevChats) => [
      ...prevChats,
      { id: newChatId, messages: [], input: '' },
    ]);
    setActiveChatId(newChatId);
  }, [chats]);

  useEffect(() => {
    scrollToBottom();
  }, [chats, activeChatId]);

  useEffect(() => {
    if (chats.length === 0) {
      handleAddChat();
    } else if (!chats.find((c) => c.id === activeChatId)) {
      setActiveChatId(chats[0].id);
    }
  }, [chats, activeChatId, handleAddChat]);

  const handleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const handleSendMessage = async (chatId) => {
    const chatIndex = chats.findIndex((c) => c.id === chatId);
    if (chatIndex !== -1 && chats[chatIndex].input.trim()) {
      const userMessage = chats[chatIndex].input.trim();
      const newMessage = { role: 'user', text: userMessage };

      const updatedChats = chats.map((chat, index) => {
        if (index === chatIndex) {
          return {
            ...chat,
            messages: [...chat.messages, newMessage],
            input: '',
          };
        }
        return chat;
      });
      setChats(updatedChats);

      setIsLoading(true);

      try {
        const currentPageContent = getCurrentPageContent();
        const apiResponse = await fetch('/api/chat-ana', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: userMessage,
            history: updatedChats[chatIndex].messages.slice(0, -1),
            pageContent: currentPageContent,
          }),
        });

        if (!apiResponse.ok) {
          const errorData = await apiResponse.json();
          throw new Error(
            errorData.error || `Erro HTTP: ${apiResponse.status}`
          );
        }

        const data = await apiResponse.json();

        setChats((prevChats) =>
          prevChats.map((chat) => {
            if (chat.id === chatId) {
              return {
                ...chat,
                messages: [
                  ...chat.messages,
                  { role: 'assistant', text: data.response },
                ],
              };
            }
            return chat;
          })
        );
      } catch (error) {
        console.error('Erro ao enviar mensagem para API:', error);
        setChats((prevChats) =>
          prevChats.map((chat) => {
            if (chat.id === chatId) {
              return {
                ...chat,
                messages: [
                  ...chat.messages,
                  {
                    role: 'assistant',
                    text: `Desculpe, ocorreu um erro: ${error.message}`,
                  },
                ],
              };
            }
            return chat;
          })
        );
      } finally {
        setIsLoading(false);
      }
    }
  };

  function getCurrentPageContent() {
    if (typeof document !== 'undefined') {
      return document.body.innerText;
    }
    return 'Conteúdo da página não disponível no servidor.';
  }

  const handleInputChange = (chatId, value) => {
    setChats((prevChats) =>
      prevChats.map((chat) =>
        chat.id === chatId ? { ...chat, input: value } : chat
      )
    );
  };

  const handleSwitchChat = (chatId) => {
    setActiveChatId(chatId);
  };

  const handleClearChat = (chatId) => {
    if (
      window.confirm(
        'Tem certeza que deseja limpar todas as mensagens deste chat?'
      )
    ) {
      setChats((prevChats) =>
        prevChats.map((chat) =>
          chat.id === chatId ? { ...chat, messages: [] } : chat
        )
      );
    }
  };

  const handleDeleteChat = (chatId) => {
    if (chats.length <= 1) {
      alert('Não é possível excluir o último chat.');
      return;
    }
    if (
      window.confirm(
        'Tem certeza que deseja excluir este chat permanentemente?'
      )
    ) {
      setChats((prevChats) => prevChats.filter((chat) => chat.id !== chatId));
    }
  };

  const activeChat = chats.find((chat) => chat.id === activeChatId);

  if (!activeChat && chats.length > 0) {
    setActiveChatId(chats[0].id);
    return null;
  } else if (!activeChat) {
    return null;
  }

  if (isMinimized) {
    return (
      <div className={chatStyles.minimizedContainer}>
        <span>Ana</span>
        <button onClick={handleMinimize} className={chatStyles.headerActions}>
          Maximizar
        </button>
      </div>
    );
  }

  return (
    <div className={chatStyles.chatContainer}>
      <div className={chatStyles.header}>
        <span className={chatStyles.headerTitle}>Ana</span>
        <div className={chatStyles.headerActions}>
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => handleSwitchChat(chat.id)}
              className={chat.id === activeChatId ? chatStyles.activeTab : ''}
            >
              {chat.id}
            </button>
          ))}
          <button onClick={handleAddChat}>+</button>
          <button onClick={handleMinimize} title="Minimizar">
            _
          </button>
        </div>
      </div>
      <div className={chatStyles.chatControls}>
        <button
          onClick={() => handleClearChat(activeChatId)}
          title="Limpar Conversa"
        >
          🧹 Limpar
        </button>
        <button
          onClick={() => handleDeleteChat(activeChatId)}
          title="Excluir Chat"
        >
          🗑️ Excluir
        </button>
      </div>
      <div className={chatStyles.chatBody}>
        <div className={chatStyles.messagesContainer}>
          {activeChat.messages.map((message, index) => (
            <div
              key={index}
              className={`${chatStyles.message} ${
                message.role === 'user'
                  ? chatStyles.userMessage
                  : chatStyles.assistantMessage
              }`}
            >
              <ReactMarkdown
                components={{
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  p: ({ node: _, ...props }) => (
                    <p {...props} style={{ marginBottom: '0.5em' }} />
                  ),
                }}
                className={chatStyles.messageContent}
              >
                {message.text}
              </ReactMarkdown>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className={chatStyles.inputArea}>
          <input
            type="text"
            value={activeChat.input}
            onChange={(e) => handleInputChange(activeChatId, e.target.value)}
            className={chatStyles.inputField}
            onKeyPress={(e) =>
              e.key === 'Enter' && handleSendMessage(activeChatId)
            }
            placeholder="Digite sua mensagem..."
            disabled={isLoading}
          />
          <button
            onClick={() => handleSendMessage(activeChatId)}
            className={chatStyles.sendButton}
            disabled={isLoading || !activeChat?.input?.trim()}
          >
            {isLoading ? '...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatAna;
