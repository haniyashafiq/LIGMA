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

  const sendMessage = () => {
    const text = input.value.trim();
    if (text) {
      const messages = container.querySelector('#chat-messages');
      const userMsg = document.createElement('div');
      userMsg.className = 'chat-message message-user';
      userMsg.textContent = text;
      messages.appendChild(userMsg);
      input.value = '';
      messages.scrollTop = messages.scrollHeight;
      
      // Placeholder for AI response
      setTimeout(() => {
        const aiMsg = document.createElement('div');
        aiMsg.className = 'chat-message message-ai';
        aiMsg.textContent = "I've received your message. Backend integration is coming soon!";
        messages.appendChild(aiMsg);
        messages.scrollTop = messages.scrollHeight;
      }, 600);
    }
  };

  sendBtn?.addEventListener('click', sendMessage);
  input?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
}
