// messages.js - Real-time chat functionality with ES6 and jQuery
$(document).ready(async () => {
    // Initialize Materialize components
    M.AutoInit();
    
    // Get current user
    const currentUser = JSON.parse(localStorage.getItem('currentUser')) || {};
    
    // State variables
    let currentConversation = null;
    let conversations = [];
    let socket = null;
    let typingTimeout = null;
    
    // Cache DOM elements
    const $chatArea = $('#chatArea');
    const $welcomeState = $('#welcomeState');
    const $conversationsList = $('#conversationsList');
    const $messagesContainer = $('#messagesContainer');
    const $messageInput = $('#messageInput');
    const $sendMessageBtn = $('#sendMessage');
    const $typingIndicator = $('#typingIndicator');
    const $typingText = $('#typingText');
    const $matchName = $('#matchName');
    const $matchAvatar = $('#matchAvatar');
    const $matchAvatarIcon = $('#matchAvatarIcon');
    const $newMatchModal = $('#newMatchModal');
    const $newMatchName = $('#newMatchName');
    const $newMatchUserIcon = $('#newMatchUserIcon');
    const $startChatBtn = $('#startChatBtn');
    const $searchConversations = $('#searchConversations');
    const $refreshBtn = $('#refreshConversations');
    
    // Check authentication
    const checkAuth = () => {
        if (!currentUser.id) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    };
    
    // Initialize chat
    const initializeChat = async () => {
        if (!checkAuth()) return;
        
        // Load conversations
        await loadConversations();
        
        // Check for match ID in URL
        const urlParams = new URLSearchParams(window.location.search);
        const matchId = urlParams.get('matchId');
        
        if (matchId) {
            // Open chat with specific match
            const conversation = conversations.find(c => c.user.id === matchId);
            if (conversation) {
                await openConversation(conversation);
            }
        }
        
        // Initialize event listeners
        initializeEventListeners();
        
        // Connect to WebSocket for real-time updates
        connectWebSocket();
    };
    
    // Initialize event listeners
    const initializeEventListeners = () => {
        $sendMessageBtn.on('click', sendMessage);
        $messageInput.on('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // Typing indicator
        $messageInput.on('input', handleTyping);
        
        // Icebreaker buttons
        $(document).on('click', '.icebreaker-btn', function() {
            const text = $(this).data('text')
                .replace('{lga}', currentConversation?.user?.lga || 'Akwa Ibom')
                .replace('{hobby}', currentConversation?.user?.hobbies?.[0] || 'activities');
            $messageInput.val(text).focus();
        });
        
        // Refresh conversations
        $refreshBtn.on('click', loadConversations);
        
        // Search conversations
        $searchConversations.on('input', debounce(searchConversations, 300));
    };
    
    // Load conversations
    const loadConversations = async () => {
        try {
            const response = await fetch(`http://localhost:3000/api/conversations/${currentUser.id}`);
            const data = await response.json();
            
            conversations = data.conversations || [];
            displayConversations();
            
            if (conversations.length === 0) {
                $conversationsList.html(`
                    <div class="empty-chat">
                        <i class="material-icons large">chat_bubble_outline</i>
                        <h5 class="cz-bold">No messages yet</h5>
                        <p class="cz-regular">Make a match to start chatting!</p>
                        <a href="matches.html" class="btn emerald-bg cz-bold">
                            <i class="material-icons left">favorite</i>Find Matches
                        </a>
                    </div>
                `);
            }
        } catch (error) {
            console.error('Error loading conversations:', error);
            showErrorToast('Failed to load conversations');
        }
    };
    
    // Display conversations list
    const displayConversations = () => {
        if (conversations.length === 0) return;
        
        $conversationsList.empty();
        
        conversations.forEach(conversation => {
            const isActive = currentConversation?.id === conversation.id;
            const avatarColor = getAvatarColor(conversation.user.id);
            const avatarInitial = conversation.user.full_name?.[0]?.toUpperCase() || '?';
            const lastMessage = conversation.last_message?.content || 'No messages yet';
            const timeAgo = formatTime(conversation.last_message?.timestamp);
            
            $conversationsList.append(`
                <div class="conversation-item ${isActive ? 'active' : ''}" 
                     data-conversation-id="${conversation.id}"
                     onclick="window.chatApp.openConversation(${JSON.stringify(conversation).replace(/"/g, '&quot;')})">
                    <div class="conversation-avatar" style="background: ${avatarColor}">
                        ${conversation.user.profile_picture ? 
                            `<img src="${conversation.user.profile_picture}" alt="${conversation.user.full_name}">` :
                            `<span style="color: white; font-weight: bold;">${avatarInitial}</span>`
                        }
                    </div>
                    <div class="conversation-content">
                        <div class="conversation-name">
                            <span class="cz-bold">${conversation.user.full_name || 'Anonymous'}</span>
                            ${conversation.unread_count > 0 ? 
                                `<span class="unread-badge">${conversation.unread_count}</span>` : 
                                `<span class="conversation-time">${timeAgo}</span>`
                            }
                        </div>
                        <div class="conversation-last-message cz-regular">
                            ${truncateText(lastMessage, 40)}
                        </div>
                    </div>
                </div>
            `);
        });
    };
    
    // Open conversation
    const openConversation = async (conversation) => {
        currentConversation = conversation;
        
        // Update UI
        $chatArea.show();
        $welcomeState.hide();
        $matchName.text(conversation.user.full_name || 'Anonymous');
        
        // Update avatar
        const avatarColor = getAvatarColor(conversation.user.id);
        const avatarInitial = conversation.user.full_name?.[0]?.toUpperCase() || '?';
        $matchAvatar.css('background', avatarColor);
        $matchAvatarIcon.text(avatarInitial);
        
        if (conversation.user.profile_picture) {
            $matchAvatarIcon.replaceWith(`<img src="${conversation.user.profile_picture}" alt="${conversation.user.full_name}">`);
        }
        
        // Update active conversation in list
        $('.conversation-item').removeClass('active');
        $(`.conversation-item[data-conversation-id="${conversation.id}"]`).addClass('active');
        
        // Load messages
        await loadMessages(conversation.id);
        
        // Mark as read
        await markAsRead(conversation.id);
        
        // Focus message input
        $messageInput.focus();
    };
    
    // Load messages for a conversation
    const loadMessages = async (conversationId) => {
        try {
            const response = await fetch(`http://localhost:3000/api/conversations/${conversationId}/messages`);
            const data = await response.json();
            
            displayMessages(data.messages || []);
        } catch (error) {
            console.error('Error loading messages:', error);
            showErrorToast('Failed to load messages');
        }
    };
    
    // Display messages
    const displayMessages = (messages) => {
        const $messagesContent = $messagesContainer.find('.messages-content');
        
        if (messages.length === 0) {
            $messagesContent.html(`
                <div class="empty-chat">
                    <h5 class="cz-bold emerald-text">Start a conversation!</h5>
                    <p class="cz-regular">Break the ice with these suggestions:</p>
                    <div class="icebreaker-suggestions">
                        <button class="btn icebreaker-btn cz-bold" 
                                data-text="Hi! I noticed we're both from ${currentConversation?.user?.lga || 'Akwa Ibom'}. How long have you lived there?">
                            <i class="material-icons left">location_on</i>Common Location
                        </button>
                        <button class="btn icebreaker-btn cz-bold" 
                                data-text="I see you like ${currentConversation?.user?.hobbies?.[0] || 'activities'}. That's one of my favorites too!">
                            <i class="material-icons left">favorite</i>Shared Hobby
                        </button>
                        <button class="btn icebreaker-btn cz-bold" 
                                data-text="Hello! How's your day going in Akwa Ibom?">
                            <i class="material-icons left">waving_hand</i>Local Greeting
                        </button>
                    </div>
                </div>
            `);
            return;
        }
        
        $messagesContent.empty();
        
        messages.forEach(message => {
            const isSent = message.sender_id === currentUser.id;
            const time = formatTime(message.timestamp);
            
            $messagesContent.append(`
                <div class="message ${isSent ? 'sent' : 'received'}">
                    <div class="message-content cz-regular">${escapeHtml(message.content)}</div>
                    <div class="message-time">${time}</div>
                </div>
            `);
        });
        
        // Scroll to bottom
        $messagesContainer.scrollTop($messagesContainer[0].scrollHeight);
    };
    
    // Send message
    const sendMessage = async () => {
        const content = $messageInput.val().trim();
        
        if (!content || !currentConversation) return;
        
        const message = {
            conversation_id: currentConversation.id,
            sender_id: currentUser.id,
            receiver_id: currentConversation.user.id,
            content: content,
            timestamp: new Date().toISOString()
        };
        
        try {
            // Send via WebSocket if connected
            if (socket?.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: 'message',
                    ...message
                }));
            } else {
                // Fallback to HTTP
                await fetch('http://localhost:3000/api/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(message)
                });
            }
            
            // Add to UI immediately
            if (!currentConversation.messages) currentConversation.messages = [];
            currentConversation.messages.push({ ...message, sender_id: currentUser.id });
            displayMessages(currentConversation.messages);
            
            // Clear input
            $messageInput.val('');
            
            // Stop typing indicator
            clearTimeout(typingTimeout);
            $typingIndicator.hide();
            
        } catch (error) {
            console.error('Error sending message:', error);
            showErrorToast('Failed to send message. Please try again.');
        }
    };
    
    // Handle typing indicator
    const handleTyping = () => {
        if (!currentConversation || !socket) return;
        
        // Send typing indicator
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'typing',
                conversation_id: currentConversation.id,
                user_id: currentUser.id,
                user_name: currentUser.full_name || 'Someone'
            }));
        }
        
        // Clear existing timeout
        clearTimeout(typingTimeout);
        
        // Set new timeout to stop typing indicator
        typingTimeout = setTimeout(() => {
            // Stop typing indicator logic here
        }, 1000);
    };
    
    // Connect to WebSocket
    const connectWebSocket = () => {
        const wsUrl = `ws://localhost:3000/ws?userId=${currentUser.id}`;
        socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {
            console.log('WebSocket connected');
        };
        
        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
        
        socket.onclose = () => {
            console.log('WebSocket disconnected. Reconnecting...');
            setTimeout(connectWebSocket, 3000);
        };
        
        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    };
    
    // Handle WebSocket messages
    const handleWebSocketMessage = (data) => {
        switch (data.type) {
            case 'message':
                handleIncomingMessage(data);
                break;
                
            case 'match':
                showNewMatchNotification(data);
                break;
                
            case 'typing':
                showTypingIndicator(data);
                break;
                
            case 'read_receipt':
                updateReadStatus(data);
                break;
                
            case 'message_delivered':
                updateMessageStatus(data);
                break;
        }
    };
    
    // Handle incoming message
    const handleIncomingMessage = (message) => {
        // Check if message belongs to current conversation
        if (currentConversation && 
            (message.conversation_id === currentConversation.id || 
             message.sender_id === currentConversation.user.id)) {
            
            // Add to current conversation
            if (!currentConversation.messages) currentConversation.messages = [];
            currentConversation.messages.push(message);
            
            // Update UI
            displayMessages(currentConversation.messages);
            
            // Send read receipt
            if (socket?.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: 'read_receipt',
                    conversation_id: currentConversation.id,
                    user_id: currentUser.id
                }));
            }
        }
        
        // Update conversations list
        updateConversationList(message);
    };
    
    // Update conversation list
    const updateConversationList = (message) => {
        // Find or create conversation
        let conversation = conversations.find(c => 
            c.id === message.conversation_id || 
            c.user.id === message.sender_id
        );
        
        if (!conversation) {
            // Fetch user info in real implementation
            conversation = {
                id: message.conversation_id,
                user: { id: message.sender_id, full_name: 'New Match' },
                last_message: message,
                unread_count: 1
            };
            conversations.unshift(conversation);
        } else {
            conversation.last_message = message;
            if (conversation !== currentConversation) {
                conversation.unread_count = (conversation.unread_count || 0) + 1;
            }
        }
        
        // Sort by last message time
        conversations.sort((a, b) => 
            new Date(b.last_message?.timestamp || 0) - new Date(a.last_message?.timestamp || 0)
        );
        
        // Update UI
        displayConversations();
    };
    
    // Show new match notification
    const showNewMatchNotification = (matchData) => {
        $newMatchName.text(matchData.user_name || 'Someone');
        
        // Set avatar
        const avatarColor = getAvatarColor(matchData.user_id);
        const avatarInitial = matchData.user_name?.[0]?.toUpperCase() || '?';
        $newMatchUserIcon.parent().css('background', avatarColor);
        $newMatchUserIcon.text(avatarInitial);
        
        // Update start chat link
        $startChatBtn.attr('href', `messages.html?matchId=${matchData.user_id}`);
        
        const modalInstance = M.Modal.getInstance($newMatchModal[0]);
        if (!modalInstance) {
            M.Modal.init($newMatchModal[0]).open();
        } else {
            modalInstance.open();
        }
    };
    
    // Show typing indicator
    const showTypingIndicator = (data) => {
        if (currentConversation && data.user_id === currentConversation.user.id) {
            $typingText.text(`${data.user_name || 'Someone'} is typing...`);
            $typingIndicator.show();
            
            // Hide after 3 seconds
            setTimeout(() => {
                $typingIndicator.hide();
            }, 3000);
        }
    };
    
    // Update read status
    const updateReadStatus = (data) => {
        if (currentConversation && data.conversation_id === currentConversation.id) {
            // Update last message read status
            const lastMessage = currentConversation.messages?.slice(-1)[0];
            if (lastMessage && lastMessage.sender_id === currentUser.id) {
                lastMessage.read = true;
            }
        }
    };
    
    // Update message status
    const updateMessageStatus = (data) => {
        // Update message status (delivered/read) in UI
        console.log('Message status updated:', data);
    };
    
    // Mark conversation as read
    const markAsRead = async (conversationId) => {
        try {
            await fetch(`http://localhost:3000/api/conversations/${conversationId}/read`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: currentUser.id })
            });
            
            // Update local state
            const conversation = conversations.find(c => c.id === conversationId);
            if (conversation) {
                conversation.unread_count = 0;
                displayConversations();
            }
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };
    
    // Search conversations
    const searchConversations = (event) => {
        const searchTerm = event.target.value.toLowerCase();
        
        if (!searchTerm) {
            displayConversations();
            return;
        }
        
        const filtered = conversations.filter(conv => 
            conv.user.full_name?.toLowerCase().includes(searchTerm) ||
            conv.last_message?.content?.toLowerCase().includes(searchTerm)
        );
        
        displayFilteredConversations(filtered);
    };
    
    // Display filtered conversations
    const displayFilteredConversations = (filtered) => {
        $conversationsList.empty();
        
        if (filtered.length === 0) {
            $conversationsList.html(`
                <div class="empty-chat">
                    <i class="material-icons">search_off</i>
                    <p class="cz-regular">No conversations found</p>
                </div>
            `);
            return;
        }
        
        filtered.forEach(conversation => {
            const isActive = currentConversation?.id === conversation.id;
            const avatarColor = getAvatarColor(conversation.user.id);
            const avatarInitial = conversation.user.full_name?.[0]?.toUpperCase() || '?';
            
            $conversationsList.append(`
                <div class="conversation-item ${isActive ? 'active' : ''}" 
                     data-conversation-id="${conversation.id}"
                     onclick="window.chatApp.openConversation(${JSON.stringify(conversation).replace(/"/g, '&quot;')})">
                    <div class="conversation-avatar" style="background: ${avatarColor}">
                        <span style="color: white; font-weight: bold;">${avatarInitial}</span>
                    </div>
                    <div class="conversation-content">
                        <div class="conversation-name">
                            <span class="cz-bold">${conversation.user.full_name || 'Anonymous'}</span>
                            ${conversation.unread_count > 0 ? 
                                `<span class="unread-badge">${conversation.unread_count}</span>` : ''
                            }
                        </div>
                        <div class="conversation-last-message cz-regular">
                            ${truncateText(conversation.last_message?.content || 'No messages yet', 40)}
                        </div>
                    </div>
                </div>
            `);
        });
    };
    
    // Helper functions
    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
        
        return date.toLocaleDateString();
    };
    
    const truncateText = (text, maxLength) => {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    };
    
    const getAvatarColor = (userId) => {
        const colors = [
            '#10b981', '#047857', '#f59e0b', '#d97706',
            '#8b5cf6', '#7c3aed', '#ef4444', '#dc2626',
            '#3b82f6', '#1d4ed8', '#ec4899', '#db2777'
        ];
        const hash = userId ? userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
        return colors[hash % colors.length];
    };
    
    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
    
    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };
    
    const showErrorToast = (message) => {
        M.toast({ html: message, classes: 'red lighten-1' });
    };
    
    // Expose functions globally
    window.chatApp = {
        openConversation,
        sendMessage
    };
    
    // Initialize the chat
    await initializeChat();
});




