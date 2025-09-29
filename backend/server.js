const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import configurations
const database = require('./config/database');
const firebaseAdmin = require('./config/firebase-admin');

// Import routes
const studentsRoutes = require('./routes/students');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize databases
async function initializeServer() {
    try {
        console.log('🚀 Starting server initialization...');
        
        // Connect to MongoDB
        await database.connect();
        
        // Initialize Firebase Admin
        firebaseAdmin.initialize();
        
        console.log('✅ Server initialization completed');
    } catch (error) {
        console.error('❌ Server initialization failed:', error);
        process.exit(1);
    }
}

// Health check endpoint (MUST come first)
app.get('/api/health', async (req, res) => {
    try {
        const mongoHealth = await database.ping();
        res.json({ 
            message: 'Student Collaboration Platform API is running',
            timestamp: new Date().toISOString(),
            mongodb: mongoHealth,
            firebase: 'connected'
        });
    } catch (error) {
        res.status(500).json({ 
            message: 'Health check failed',
            error: error.message 
        });
    }
});

// API Routes
app.use('/api/students', studentsRoutes);

// Serve static files from frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Specific frontend routes
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/register.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dashboard.html'));
});

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 Server starting on port ${PORT}...`);
    await initializeServer();
    console.log(`✅ Server is running on http://localhost:${PORT}`);
    console.log(`📊 API health check: http://localhost:${PORT}/api/health`);
});
