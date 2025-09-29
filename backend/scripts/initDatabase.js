const database = require('../config/database');
const firebaseAdmin = require('../config/firebase-admin');
const Student = require('../models/Student');

class DatabaseInitializer {
    constructor() {
        this.db = null;
    }

    async initialize() {
        try {
            console.log('🚀 Starting database initialization...');
            
            // Connect to databases
            this.db = await database.connect();
            firebaseAdmin.initialize();
            
            // Create indexes for better performance [web:41][web:54]
            await this.createIndexes();
            
            // Create initial collections structure
            await this.createCollections();
            
            console.log('✅ Database initialization completed successfully');
        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            process.exit(1);
        }
    }

    async createIndexes() {
        const students = this.db.collection('students');
        
        // Index for faster queries [web:41][web:54]
        await students.createIndex({ 'personalInfo.collegeEmail': 1 }, { unique: true });
        await students.createIndex({ 'academicDetails.stream': 1 });
        await students.createIndex({ 'skillsInterests.mainSkills': 1 });
        await students.createIndex({ 'firebaseUID': 1 }, { unique: true, sparse: true });
        await students.createIndex({ 'isOnline': 1 });
        await students.createIndex({ 'lastActive': 1 });
        
        console.log('📊 MongoDB indexes created successfully');
    }

    async createCollections() {
    try {
        // Check if collections exist and drop them for fresh start
        const collections = await this.db.listCollections().toArray();
        const existingCollectionNames = collections.map(col => col.name);
        
        const collectionsToCreate = ['students', 'collaboration_requests', 'projects'];
        
        for (const collectionName of collectionsToCreate) {
            if (existingCollectionNames.includes(collectionName)) {
                console.log(`🗑️  Dropping existing collection: ${collectionName}`);
                await this.db.collection(collectionName).drop();
            }
        }
        
        // Create collections with validation
        await this.db.createCollection('students', {
            validator: {
                $jsonSchema: {
                    bsonType: 'object',
                    required: ['personalInfo', 'academicDetails', 'skillsInterests'],
                    properties: {
                        personalInfo: {
                            bsonType: 'object',
                            required: ['fullName', 'collegeEmail', 'rollNumber'],
                            properties: {
                                fullName: { bsonType: 'string', minLength: 1 },
                                collegeEmail: { bsonType: 'string', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
                                rollNumber: { bsonType: 'string', minLength: 1 }
                            }
                        },
                        academicDetails: {
                            bsonType: 'object',
                            required: ['stream', 'cohort', 'currentYear'],
                            properties: {
                                stream: { bsonType: 'string', minLength: 1 },
                                cohort: { bsonType: 'string', minLength: 1 },
                                currentYear: { bsonType: 'string', minLength: 1 }
                            }
                        }
                    }
                }
            }
        });

        await this.db.createCollection('collaboration_requests');
        await this.db.createCollection('projects');
        
        console.log('📁 MongoDB collections created successfully');
        
    } catch (error) {
        console.log('⚠️  Collection creation warning:', error.message);
        console.log('📝 Continuing with existing collections...');
    }
}


    async insertSampleData() {
        const sampleStudents = require('../../data/sample-students.json');
        const students = this.db.collection('students');
        
        for (const studentData of sampleStudents) {
            try {
                const student = new Student(studentData);
                await students.insertOne(student.toDocument());
            } catch (error) {
                console.log(`⚠️ Skipping duplicate student: ${studentData.personalInfo.collegeEmail}`);
            }
        }
        
        console.log('📝 Sample data inserted successfully');
    }
}

// Run initialization if called directly
if (require.main === module) {
    const initializer = new DatabaseInitializer();
    initializer.initialize()
        .then(() => initializer.insertSampleData())
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Initialization failed:', error);
            process.exit(1);
        });
}

module.exports = DatabaseInitializer;
