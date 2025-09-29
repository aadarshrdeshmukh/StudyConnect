const { MongoClient } = require('mongodb');
require('dotenv').config();

class Database {
    constructor() {
        this.client = null;
        this.db = null;
    }

    async connect() {
        try {
            // Connection with latest best practices [web:41][web:44]
            this.client = new MongoClient(process.env.MONGODB_URI, {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            });

            await this.client.connect();
            this.db = this.client.db(process.env.DATABASE_NAME);
            
            console.log('✅ MongoDB connected successfully');
            return this.db;
        } catch (error) {
            console.error('❌ MongoDB connection failed:', error);
            process.exit(1);
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.close();
            console.log('🔐 MongoDB connection closed');
        }
    }

    getDb() {
        if (!this.db) {
            throw new Error('Database not connected. Call connect() first.');
        }
        return this.db;
    }

    // Health check method
    async ping() {
        try {
            await this.db.admin().ping();
            return { status: 'connected', timestamp: new Date().toISOString() };
        } catch (error) {
            return { status: 'disconnected', error: error.message };
        }
    }
}

module.exports = new Database();
