const express = require('express');
const { ObjectId } = require('mongodb');
const database = require('../config/database');
const firebaseAdmin = require('../config/firebase-admin');
const Student = require('../models/Student');

const router = express.Router();

// Middleware to verify Firebase token
async function verifyFirebaseToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No valid authorization token provided' });
        }

        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await firebaseAdmin.verifyIdToken(idToken);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('Token verification failed:', error);
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// Create student profile (called after Firebase registration)
router.post('/create-profile', verifyFirebaseToken, async (req, res) => {
    try {
        const db = database.getDb();
        const students = db.collection('students');
        
        console.log('📊 Creating student profile for:', req.user.uid);
        console.log('📝 Received data:', JSON.stringify(req.body, null, 2));
        
        // Handle both flat and nested data structures
        const requestBody = req.body;
        const studentData = {
            // Handle nested personalInfo structure
            fullName: requestBody.personalInfo?.fullName || requestBody.fullName,
            collegeEmail: requestBody.personalInfo?.collegeEmail || requestBody.collegeEmail,
            rollNumber: requestBody.personalInfo?.rollNumber || requestBody.rollNumber,
            
            // Handle nested academicDetails structure  
            stream: requestBody.academicDetails?.stream || requestBody.stream,
            cohort: requestBody.academicDetails?.cohort || requestBody.cohort,
            currentYear: requestBody.academicDetails?.currentYear || requestBody.currentYear,
            
            // Handle nested skillsInterests structure
            mainSkills: requestBody.skillsInterests?.mainSkills || requestBody.mainSkills || [],
            portfolioLink: requestBody.skillsInterests?.portfolioLink || requestBody.portfolioLink || '',
            
            // Firebase and system fields
            firebaseUID: req.user.uid
        };

        console.log('📝 Processed student data:', JSON.stringify(studentData, null, 2));

        // Create Student instance with validation
        const student = new Student(studentData);
        const validatedData = student.toDocument();

        // Check if student with this email already exists
        const existingStudent = await students.findOne({
            'personalInfo.collegeEmail': validatedData.personalInfo.collegeEmail
        });

        if (existingStudent) {
            return res.status(409).json({ 
                error: 'A student with this email already exists',
                code: 'EMAIL_EXISTS'
            });
        }

        // Check if Firebase UID is already linked
        const existingUID = await students.findOne({
            'firebaseUID': req.user.uid
        });

        if (existingUID) {
            return res.status(409).json({ 
                error: 'This account is already linked to a student profile',
                code: 'UID_EXISTS'
            });
        }

        // Insert the new student profile
        const result = await students.insertOne(validatedData);
        
        console.log('✅ Student profile created with ID:', result.insertedId);

        // Return success with student data (excluding sensitive info)
        const responseData = {
            _id: result.insertedId,
            personalInfo: validatedData.personalInfo,
            academicDetails: validatedData.academicDetails,
            skillsInterests: validatedData.skillsInterests,
            collaborationPrefs: validatedData.collaborationPrefs,
            profileComplete: validatedData.profileComplete
        };

        res.status(201).json({
            message: 'Student profile created successfully',
            student: responseData
        });

    } catch (error) {
        console.error('❌ Error creating student profile:', error);
        
        if (error.message.includes('required') || error.message.includes('validation')) {
            res.status(400).json({ error: error.message, receivedData: req.body });
        } else if (error.code === 11000) {
            // MongoDB duplicate key error
            res.status(409).json({ 
                error: 'A student with this information already exists',
                code: 'DUPLICATE_DATA'
            });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});


// Get current user's profile
router.get('/profile', verifyFirebaseToken, async (req, res) => {
    try {
        const db = database.getDb();
        const students = db.collection('students');
        
        const student = await students.findOne(
            { firebaseUID: req.user.uid },
            { projection: { personalInfo: 1, academicDetails: 1, skillsInterests: 1, collaborationPrefs: 1, profileComplete: 1, lastActive: 1 } }
        );

        if (!student) {
            return res.status(404).json({ 
                error: 'Student profile not found',
                code: 'PROFILE_NOT_FOUND'
            });
        }

        // Update last active time
        await students.updateOne(
            { firebaseUID: req.user.uid },
            { $set: { lastActive: new Date(), isOnline: true } }
        );

        res.json({
            message: 'Profile retrieved successfully',
            student: student
        });

    } catch (error) {
        console.error('❌ Error fetching profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user's online status
router.patch('/status', verifyFirebaseToken, async (req, res) => {
    try {
        const db = database.getDb();
        const students = db.collection('students');
        
        const { isOnline } = req.body;
        
        const result = await students.updateOne(
            { firebaseUID: req.user.uid },
            { 
                $set: { 
                    isOnline: isOnline,
                    lastActive: new Date()
                } 
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ 
                error: 'Student profile not found',
                code: 'PROFILE_NOT_FOUND'
            });
        }

        res.json({
            message: 'Status updated successfully',
            isOnline: isOnline
        });

    } catch (error) {
        console.error('❌ Error updating status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Find peers by stream
router.get('/peers/:stream', verifyFirebaseToken, async (req, res) => {
    try {
        const db = database.getDb();
        const students = db.collection('students');
        
        const { stream } = req.params;
        const limit = parseInt(req.query.limit) || 10;
        
        // Find students from the same stream, excluding current user
        const peers = await students.find(
            Student.getMatchQuery(stream, null),
            { 
                projection: { 
                    personalInfo: { fullName: 1, collegeEmail: 1 },
                    academicDetails: 1,
                    skillsInterests: { mainSkills: 1 },
                    isOnline: 1,
                    lastActive: 1
                } 
            }
        )
        .sort({ isOnline: -1, lastActive: -1 })
        .limit(limit)
        .toArray();

        // Filter out the current user
        const filteredPeers = peers.filter(peer => peer.firebaseUID !== req.user.uid);

        res.json({
            message: 'Peers retrieved successfully',
            stream: stream,
            peers: filteredPeers,
            total: filteredPeers.length
        });

    } catch (error) {
        console.error('❌ Error fetching peers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Find peers by skills
router.post('/peers/by-skills', verifyFirebaseToken, async (req, res) => {
    try {
        const db = database.getDb();
        const students = db.collection('students');
        
        const { skills } = req.body;
        const limit = parseInt(req.query.limit) || 10;
        
        if (!Array.isArray(skills) || skills.length === 0) {
            return res.status(400).json({ error: 'Skills array is required' });
        }

        // Find students with matching skills, excluding current user
        const peers = await students.find(
            Student.getSkillsMatchQuery(skills, null),
            { 
                projection: { 
                    personalInfo: { fullName: 1, collegeEmail: 1 },
                    academicDetails: 1,
                    skillsInterests: 1,
                    isOnline: 1,
                    lastActive: 1
                } 
            }
        )
        .sort({ isOnline: -1, lastActive: -1 })
        .limit(limit)
        .toArray();

        // Filter out the current user and add match score
        const filteredPeers = peers
            .filter(peer => peer.firebaseUID !== req.user.uid)
            .map(peer => {
                const matchingSkills = peer.skillsInterests.mainSkills.filter(skill => 
                    skills.includes(skill)
                );
                return {
                    ...peer,
                    matchScore: matchingSkills.length,
                    matchingSkills: matchingSkills
                };
            })
            .sort((a, b) => b.matchScore - a.matchScore);

        res.json({
            message: 'Skill-based peers retrieved successfully',
            searchSkills: skills,
            peers: filteredPeers,
            total: filteredPeers.length
        });

    } catch (error) {
        console.error('❌ Error fetching skill-based peers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
