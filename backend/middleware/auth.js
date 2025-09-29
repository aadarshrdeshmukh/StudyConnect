const firebaseAdmin = require('../config/firebase-admin');

// Middleware to verify Firebase authentication token
async function authenticateUser(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({ 
                error: 'Authorization header is required',
                code: 'NO_AUTH_HEADER'
            });
        }

        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                error: 'Authorization header must start with "Bearer "',
                code: 'INVALID_AUTH_FORMAT'
            });
        }

        const idToken = authHeader.split('Bearer ')[1];
        
        if (!idToken) {
            return res.status(401).json({ 
                error: 'No token provided',
                code: 'NO_TOKEN'
            });
        }

        // Verify the Firebase ID token
        const decodedToken = await firebaseAdmin.verifyIdToken(idToken);
        
        // Attach user info to request
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            emailVerified: decodedToken.email_verified
        };

        // Check if email is verified (optional, uncomment if needed)
        // if (!decodedToken.email_verified) {
        //     return res.status(403).json({ 
        //         error: 'Email not verified. Please verify your email before proceeding.',
        //         code: 'EMAIL_NOT_VERIFIED'
        //     });
        // }

        next();

    } catch (error) {
        console.error('❌ Authentication error:', error);
        
        let errorMessage = 'Authentication failed';
        let errorCode = 'AUTH_FAILED';

        if (error.code === 'auth/id-token-expired') {
            errorMessage = 'Token has expired. Please login again.';
            errorCode = 'TOKEN_EXPIRED';
        } else if (error.code === 'auth/id-token-revoked') {
            errorMessage = 'Token has been revoked. Please login again.';
            errorCode = 'TOKEN_REVOKED';
        } else if (error.code === 'auth/invalid-id-token') {
            errorMessage = 'Invalid authentication token.';
            errorCode = 'INVALID_TOKEN';
        }

        res.status(401).json({ 
            error: errorMessage,
            code: errorCode
        });
    }
}

// Optional: Middleware to check if user has a complete profile
async function requireCompleteProfile(req, res, next) {
    try {
        const database = require('../config/database');
        const db = database.getDb();
        const students = db.collection('students');
        
        const student = await students.findOne(
            { firebaseUID: req.user.uid },
            { projection: { profileComplete: 1 } }
        );

        if (!student) {
            return res.status(404).json({ 
                error: 'Student profile not found. Please complete registration.',
                code: 'PROFILE_NOT_FOUND'
            });
        }

        if (!student.profileComplete) {
            return res.status(403).json({ 
                error: 'Profile is incomplete. Please complete your profile.',
                code: 'PROFILE_INCOMPLETE'
            });
        }

        next();

    } catch (error) {
        console.error('❌ Profile check error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
}

module.exports = {
    authenticateUser,
    requireCompleteProfile
};
