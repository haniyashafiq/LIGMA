/**
 * Renders the AI Assistant UI screen
 * @param {HTMLElement} container - The element to render into
 */
export function renderAIAssistantUI(container) {
  container.innerHTML = `
    <div class="ai-screen">
      <header class="ai-header">
        <h1>LIGMA AI Assistant</h1>
        <div style="display:flex; gap: 10px;">
          <button id="back-to-workspaces" style="background: rgba(255,255,255,0.1); color: white; padding: 0.5rem 1rem;">Workspaces</button>
          <button id="ai-logout" style="background: rgba(242, 95, 92, 0.2); color: #ffb5b4; padding: 0.5rem 1rem;">Logout</button>
        </div>
      </header>

      <div class="ai-container">
        <div class="chat-area" id="chat-messages">
          <div class="chat-message message-ai">
            Hello! I am your LIGMA AI assistant. How can I help you manage your workspaces today?
          </div>
        </div>
        
        <div class="chat-input-area">
          <input type="text" class="chat-input" id="chat-input" placeholder="Type your message here..." autofocus>
          <button class="chat-send-btn" id="chat-send">Send</button>
        </div>
      </div>
    </div>
  `;

  // Basic event listeners (without backend implementation yet)
  const backBtn = container.querySelector('#back-to-workspaces');
  const logoutBtn = container.querySelector('#ai-logout');
  const sendBtn = container.querySelector('#chat-send');
  const input = container.querySelector('#chat-input');

  backBtn?.addEventListener('click', () => {
    window.location.hash = '#/workspaces';
  });

  logoutBtn?.addEventListener('click', () => {
    window.location.hash = '#/logout'; // main.js will handle logout
  });

  // Conversation history for multi-turn context
  const chatHistory = [];

  const sendMessage = async () => {
    const text = input.value.trim();
    if (!text) return;

    const messages = container.querySelector('#chat-messages');

    // Show user message
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-message message-user';
    userMsg.textContent = text;
    messages.appendChild(userMsg);
    input.value = '';
    messages.scrollTop = messages.scrollHeight;

    // Disable input while waiting
    input.disabled = true;
    sendBtn.disabled = true;

    // Show typing indicator
    const typingMsg = document.createElement('div');
    typingMsg.className = 'chat-message message-ai';
    typingMsg.textContent = '⏳ Thinking...';
    messages.appendChild(typingMsg);
    messages.scrollTop = messages.scrollHeight;

    try {
      const res = await fetch('/chatbot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: chatHistory,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error (${res.status})`);
      }

      const data = await res.json();
      
      // Update typing indicator with final reply
      typingMsg.innerHTML = '';
      const textNode = document.createTextNode(data.reply);
      typingMsg.appendChild(textNode);

      // Update history
      chatHistory.push({ role: 'user', content: text });
      chatHistory.push({ role: 'ai', content: data.reply });
    } catch (err) {
      typingMsg.textContent = `⚠️ Error: ${err.message}`;
    } finally {
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
      messages.scrollTop = messages.scrollHeight;
    }
  };

  sendBtn?.addEventListener('click', sendMessage);
  input?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
}
