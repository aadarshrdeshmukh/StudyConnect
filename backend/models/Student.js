const { ObjectId } = require('mongodb');

class Student {
    constructor(studentData) {
        this.personalInfo = {
            fullName: studentData.fullName || '',
            collegeEmail: studentData.collegeEmail || '',
            rollNumber: studentData.rollNumber || ''
        };
        
        this.academicDetails = {
            stream: studentData.stream || '',
            cohort: studentData.cohort || '',
            currentYear: studentData.currentYear || ''
        };
        
        this.skillsInterests = {
            mainSkills: studentData.mainSkills || [],
            portfolioLink: studentData.portfolioLink || ''
        };
        
        this.collaborationPrefs = {
            streamBased: true,
            crossStream: true,
            activeProjects: [],
            interestedInNewProjects: true
        };
        
        this.firebaseUID = studentData.firebaseUID || null;
        this.createdAt = new Date();
        this.lastActive = new Date();
        this.isOnline = false;
        this.profileComplete = false;
    }

    // Validation methods
    validateRequired() {
        const required = [
            'personalInfo.fullName',
            'personalInfo.collegeEmail', 
            'personalInfo.rollNumber',
            'academicDetails.stream',
            'academicDetails.cohort',
            'academicDetails.currentYear'
        ];

        for (const field of required) {
            const value = this.getNestedValue(field);
            if (!value || value.trim() === '') {
                throw new Error(`${field} is required`);
            }
        }
    }

    validateEmail() {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(this.personalInfo.collegeEmail)) {
            throw new Error('Invalid email format');
        }
    }

    validateSkills() {
        if (!Array.isArray(this.skillsInterests.mainSkills) || 
            this.skillsInterests.mainSkills.length === 0) {
            throw new Error('At least one skill must be selected');
        }
    }

    getNestedValue(path) {
        return path.split('.').reduce((obj, key) => obj && obj[key], this);
    }

    // Method to prepare data for database insertion
    toDocument() {
        this.validateRequired();
        this.validateEmail();
        this.validateSkills();
        
        this.profileComplete = true;
        return { ...this };
    }

    // Static method to find students by stream
    static getMatchQuery(stream, excludeId = null) {
        const query = { 'academicDetails.stream': stream };
        if (excludeId) {
            query._id = { $ne: new ObjectId(excludeId) };
        }
        return query;
    }

    // Static method to find students by skills
    static getSkillsMatchQuery(skills, excludeId = null) {
        const query = {
            'skillsInterests.mainSkills': { $in: skills }
        };
        if (excludeId) {
            query._id = { $ne: new ObjectId(excludeId) };
        }
        return query;
    }
}

module.exports = Student;
