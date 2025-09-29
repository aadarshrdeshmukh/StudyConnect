// Chat utility functions for Firestore integration
import { 
    collection, 
    doc, 
    addDoc, 
    query, 
    orderBy, 
    limit, 
    onSnapshot, 
    serverTimestamp,
    where,
    getDocs,
    updateDoc,
    setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Global chat state
window.ChatApp = {
    db: null,
    currentUser: null,
    currentRoom: null,
    unsubscribers: [],
    messageListeners: new Map(),
    
    // Initialize chat system
    init(firestore, user) {
        this.db = firestore;
        this.currentUser = user;
        console.log('💬 Chat system initialized for:', user.email);
    },
    
    // Clean up listeners when leaving chat
    cleanup() {
        this.unsubscribers.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.unsubscribers = [];
        this.messageListeners.clear();
        console.log('🧹 Chat listeners cleaned up');
    },
    
    // Create a new chat room [web:7]
    async createChatRoom(roomData) {
        try {
            const roomsRef = collection(this.db, 'chatRooms');
            const newRoom = {
                name: roomData.name,
                description: roomData.description || '',
                type: roomData.type || 'general', // 'general', 'stream', 'private'
                stream: roomData.stream || null,
                participants: [this.currentUser.uid],
                moderators: [this.currentUser.uid],
                createdBy: this.currentUser.uid,
                createdAt: serverTimestamp(),
                lastActivity: serverTimestamp(),
                messageCount: 0,
                isActive: true
            };
            
            const docRef = await addDoc(roomsRef, newRoom);
            console.log('✅ Chat room created:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('❌ Error creating chat room:', error);
            throw error;
        }
    },
    
    // Get available chat rooms [web:153][web:7]
    async getChatRooms(streamFilter = null) {
        try {
            let q = query(
                collection(this.db, 'chatRooms'),
                orderBy('lastActivity', 'desc'),
                limit(20)
            );
            
            if (streamFilter) {
                q = query(
                    collection(this.db, 'chatRooms'),
                    where('stream', '==', streamFilter),
                    orderBy('lastActivity', 'desc'),
                    limit(20)
                );
            }
            
            const snapshot = await getDocs(q);
            const rooms = [];
            
            snapshot.forEach((doc) => {
                rooms.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            console.log(`📋 Found ${rooms.length} chat rooms`);
            return rooms;
        } catch (error) {
            console.error('❌ Error fetching chat rooms:', error);
            throw error;
        }
    },
    
    // Listen to chat rooms in real-time [web:153]
    listenToChatRooms(callback, streamFilter = null) {
        let q = query(
            collection(this.db, 'chatRooms'),
            orderBy('lastActivity', 'desc'),
            limit(20)
        );
        
        if (streamFilter) {
            q = query(
                collection(this.db, 'chatRooms'),
                where('stream', '==', streamFilter),
                orderBy('lastActivity', 'desc'),
                limit(20)
            );
        }
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const rooms = [];
            snapshot.forEach((doc) => {
                rooms.push({
                    id: doc.id,
                    ...doc.data(),
                    // Convert timestamps for display
                    createdAt: doc.data().createdAt?.toDate(),
                    lastActivity: doc.data().lastActivity?.toDate()
                });
            });
            
            callback(rooms);
        }, (error) => {
            console.error('❌ Error listening to chat rooms:', error);
        });
        
        this.unsubscribers.push(unsubscribe);
        return unsubscribe;
    },
    
    // Join a chat room
    async joinChatRoom(roomId) {
        try {
            this.currentRoom = roomId;
            
            // Update user's participation in the room
            const roomRef = doc(this.db, 'chatRooms', roomId);
            await updateDoc(roomRef, {
                participants: [...new Set([this.currentUser.uid])], // Add user if not already there
                lastActivity: serverTimestamp()
            });
            
            console.log('🚪 Joined chat room:', roomId);
            return roomId;
        } catch (error) {
            console.error('❌ Error joining chat room:', error);
            throw error;
        }
    },
    
    // Send a message to a chat room [web:7][web:158]
    async sendMessage(roomId, messageText, messageType = 'text') {
        try {
            if (!messageText.trim()) {
                throw new Error('Message cannot be empty');
            }
            
            const messagesRef = collection(this.db, 'chatRooms', roomId, 'messages');
            const message = {
                text: messageText.trim(),
                senderId: this.currentUser.uid,
                senderName: this.currentUser.displayName || this.currentUser.email,
                senderEmail: this.currentUser.email,
                type: messageType,
                timestamp: serverTimestamp(),
                edited: false,
                reactions: {}
            };
            
            // Add message to subcollection
            await addDoc(messagesRef, message);
            
            // Update room's last activity and message count
            const roomRef = doc(this.db, 'chatRooms', roomId);
            await updateDoc(roomRef, {
                lastActivity: serverTimestamp(),
                messageCount: increment(1)
            });
            
            console.log('📤 Message sent to room:', roomId);
        } catch (error) {
            console.error('❌ Error sending message:', error);
            throw error;
        }
    },
    
    // Listen to messages in real-time [web:153][web:158]
    listenToMessages(roomId, callback, messageLimit = 50) {
        const messagesRef = collection(this.db, 'chatRooms', roomId, 'messages');
        const q = query(
            messagesRef,
            orderBy('timestamp', 'desc'),
            limit(messageLimit)
        );
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const messages = [];
            snapshot.forEach((doc) => {
                messages.push({
                    id: doc.id,
                    ...doc.data(),
                    // Convert timestamp for display
                    timestamp: doc.data().timestamp?.toDate()
                });
            });
            
            // Reverse to show oldest first
            messages.reverse();
            callback(messages);
        }, (error) => {
            console.error('❌ Error listening to messages:', error);
        });
        
        this.messageListeners.set(roomId, unsubscribe);
        this.unsubscribers.push(unsubscribe);
        return unsubscribe;
    },
    
    // Update user's online presence [web:153]
    async updatePresence(isOnline = true) {
        try {
            const presenceRef = doc(this.db, 'presence', this.currentUser.uid);
            await setDoc(presenceRef, {
                uid: this.currentUser.uid,
                email: this.currentUser.email,
                displayName: this.currentUser.displayName || this.currentUser.email,
                isOnline: isOnline,
                lastSeen: serverTimestamp(),
                updatedAt: serverTimestamp()
            }, { merge: true });
            
            console.log(`👤 Presence updated: ${isOnline ? 'online' : 'offline'}`);
        } catch (error) {
            console.error('❌ Error updating presence:', error);
        }
    },
    
    // Get online users
    listenToOnlineUsers(callback) {
        const presenceRef = collection(this.db, 'presence');
        const q = query(presenceRef, where('isOnline', '==', true));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const onlineUsers = [];
            snapshot.forEach((doc) => {
                onlineUsers.push({
                    ...doc.data(),
                    lastSeen: doc.data().lastSeen?.toDate()
                });
            });
            
            callback(onlineUsers);
        });
        
        this.unsubscribers.push(unsubscribe);
        return unsubscribe;
    },
    
    // Leave current room
    async leaveChatRoom(roomId) {
        try {
            // Stop listening to messages for this room
            const messageListener = this.messageListeners.get(roomId);
            if (messageListener) {
                messageListener();
                this.messageListeners.delete(roomId);
            }
            
            this.currentRoom = null;
            console.log('🚪 Left chat room:', roomId);
        } catch (error) {
            console.error('❌ Error leaving chat room:', error);
        }
    },
    
    // Format timestamp for display
    formatTimestamp(timestamp) {
        if (!timestamp) return '';
        
        const now = new Date();
        const messageTime = new Date(timestamp);
        const diffInMinutes = Math.floor((now - messageTime) / (1000 * 60));
        
        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
        
        return messageTime.toLocaleDateString();
    },
    
    // Format time only
    formatTime(timestamp) {
        if (!timestamp) return '';
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
};

console.log('💬 Chat utilities loaded');
