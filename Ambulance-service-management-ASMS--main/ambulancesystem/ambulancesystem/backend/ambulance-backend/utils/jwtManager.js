const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * JWT Secret Rotation Mechanism
 * 
 * This module provides functionality for rotating JWT secrets periodically
 * to enhance security. It maintains both current and previous secrets to
 * allow for graceful token validation during rotation periods.
 */

class JWTSecretManager {
  constructor() {
    this.currentSecret = process.env.JWT_SECRET;
    this.previousSecret = process.env.JWT_PREVIOUS_SECRET || null;
    this.secretsFilePath = path.join(__dirname, '../.secrets.json');
    this.rotationInterval = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
    
    // Load secrets from file if exists
    this.loadSecrets();
  }

  /**
   * Load secrets from persistent storage
   */
  loadSecrets() {
    try {
      if (fs.existsSync(this.secretsFilePath)) {
        const data = fs.readFileSync(this.secretsFilePath, 'utf8');
        const secrets = JSON.parse(data);
        
        if (secrets.currentSecret) {
          this.currentSecret = secrets.currentSecret;
        }
        if (secrets.previousSecret) {
          this.previousSecret = secrets.previousSecret;
        }
        if (secrets.rotatedAt) {
          this.lastRotatedAt = new Date(secrets.rotatedAt);
        }
      }
    } catch (error) {
      console.error('Error loading secrets:', error);
    }
  }

  /**
   * Save secrets to persistent storage
   */
  saveSecrets() {
    try {
      const data = {
        currentSecret: this.currentSecret,
        previousSecret: this.previousSecret,
        rotatedAt: new Date().toISOString()
      };
      
      fs.writeFileSync(
        this.secretsFilePath, 
        JSON.stringify(data, null, 2),
        { mode: 0o600 } // Read/write for owner only
      );
    } catch (error) {
      console.error('Error saving secrets:', error);
    }
  }

  /**
   * Generate a new cryptographically secure secret
   */
  generateSecret() {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Rotate the JWT secret
   */
  rotateSecret() {
    console.log('Rotating JWT secret...');
    
    // Move current secret to previous
    this.previousSecret = this.currentSecret;
    
    // Generate new current secret
    this.currentSecret = this.generateSecret();
    
    // Save to file
    this.saveSecrets();
    
    this.lastRotatedAt = new Date();
    
    console.log('JWT secret rotated successfully at:', this.lastRotatedAt);
    console.log('New tokens will use the new secret');
    console.log('Old tokens can still be validated with the previous secret for 7 days');
    
    return {
      rotatedAt: this.lastRotatedAt,
      message: 'Secret rotated successfully'
    };
  }

  /**
   * Sign a new JWT token
   */
  sign(payload, options = {}) {
    const defaultOptions = {
      expiresIn: '7d',
      ...options
    };
    
    return jwt.sign(payload, this.currentSecret, defaultOptions);
  }

  /**
   * Verify a JWT token - try current secret first, then previous
   */
  verify(token) {
    try {
      // Try with current secret
      return jwt.verify(token, this.currentSecret);
    } catch (currentError) {
      if (this.previousSecret) {
        try {
          // Try with previous secret (for tokens issued before rotation)
          const decoded = jwt.verify(token, this.previousSecret);
          console.log('Token validated with previous secret (rotation grace period)');
          return decoded;
        } catch (previousError) {
          throw currentError; // Throw original error if both fail
        }
      } else {
        throw currentError;
      }
    }
  }

  /**
   * Check if rotation is needed based on time
   */
  needsRotation() {
    if (!this.lastRotatedAt) {
      return false; // Don't auto-rotate if never manually rotated
    }
    
    const timeSinceRotation = Date.now() - this.lastRotatedAt.getTime();
    return timeSinceRotation >= this.rotationInterval;
  }

  /**
   * Schedule automatic rotation check
   */
  startAutoRotation() {
    // Check every day if rotation is needed
    setInterval(() => {
      if (this.needsRotation()) {
        this.rotateSecret();
      }
    }, 24 * 60 * 60 * 1000); // Check daily
    
    console.log('JWT secret auto-rotation scheduler started');
  }

  /**
   * Get current secret info (for debugging - don't expose in production)
   */
  getInfo() {
    return {
      hasCurrentSecret: !!this.currentSecret,
      hasPreviousSecret: !!this.previousSecret,
      lastRotatedAt: this.lastRotatedAt,
      needsRotation: this.needsRotation()
    };
  }
}

// Create singleton instance
const jwtManager = new JWTSecretManager();

// Export the manager and convenience functions
module.exports = {
  jwtManager,
  generateToken: (payload, options) => jwtManager.sign(payload, options),
  verifyToken: (token) => jwtManager.verify(token),
  rotateSecret: () => jwtManager.rotateSecret(),
  startAutoRotation: () => jwtManager.startAutoRotation(),
  getSecretInfo: () => jwtManager.getInfo()
};
