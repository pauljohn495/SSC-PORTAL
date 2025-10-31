import Handbook from '../models/Handbook.js';
import Memorandum from '../models/Memorandum.js';

// Cleanup expired priorities
export const cleanupExpiredPriorities = async () => {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    // Clear expired handbook priorities
    await Handbook.updateMany(
      { 
        priorityEditor: { $exists: true, $ne: null },
        priorityEditStartedAt: { $lt: tenMinutesAgo } 
      },
      { 
        $set: { 
          priorityEditor: null, 
          priorityEditStartedAt: null 
        } 
      }
    );
    
    // Clear expired memorandum priorities
    await Memorandum.updateMany(
      { 
        priorityEditor: { $exists: true, $ne: null },
        priorityEditStartedAt: { $lt: tenMinutesAgo } 
      },
      { 
        $set: { 
          priorityEditor: null, 
          priorityEditStartedAt: null 
        } 
      }
    );
  } catch (error) {
    console.error('Error cleaning up expired priorities:', error);
  }
};

export const startPriorityCleanupInterval = () => {
  // Run immediately
  cleanupExpiredPriorities();
  
  // Then run every 10 minutes
  setInterval(cleanupExpiredPriorities, 10 * 60 * 1000);
  console.log('Priority cleanup interval started');
};

