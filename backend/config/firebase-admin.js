const admin = require('firebase-admin');
require('dotenv').config();

class FirebaseAdmin {
    constructor() {
        this.app = null;
        this.auth = null;
        this.firestore = null;
    }

    initialize() {
        try {
            // Initialize Firebase Admin with service account [web:46][web:55]
            const serviceAccount = {
                projectId: process.env.FIREBASE_PROJECT_ID,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            };

            this.app = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: process.env.FIREBASE_PROJECT_ID
            });

            this.auth = admin.auth();
            this.firestore = admin.firestore();

            console.log('✅ Firebase Admin initialized successfully');
            return this.app;
        } catch (error) {
            console.error('❌ Firebase Admin initialization failed:', error);
            process.exit(1);
        }
    }

    // Verify Firebase ID token
    async verifyIdToken(idToken) {
        try {
            const decodedToken = await this.auth.verifyIdToken(idToken);
            return decodedToken;
        } catch (error) {
            throw new Error(`Token verification failed: ${error.message}`);
        }
    }

    // Create custom token
    async createCustomToken(uid, additionalClaims = {}) {
        try {
            return await this.auth.createCustomToken(uid, additionalClaims);
        } catch (error) {
            throw new Error(`Custom token creation failed: ${error.message}`);
        }
    }

    // Get user by email
    async getUserByEmail(email) {
        try {
            return await this.auth.getUserByEmail(email);
        } catch (error) {
            throw new Error(`User lookup failed: ${error.message}`);
        }
    }

    getAuth() {
        if (!this.auth) {
            throw new Error('Firebase Admin not initialized');
        }
        return this.auth;
    }

    getFirestore() {
        if (!this.firestore) {
            throw new Error('Firebase Admin not initialized');
        }
        return this.firestore;
    }
}

module.exports = new FirebaseAdmin();
