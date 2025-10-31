import Handbook from '../models/Handbook.js';
import Memorandum from '../models/Memorandum.js';

// Get all approved handbooks
export const getPublicHandbooks = async (req, res, next) => {
  try {
    const handbooks = await Handbook.find({ status: 'approved' }).sort({ createdAt: -1 });
    res.json(handbooks);
  } catch (error) {
    next(error);
  }
};

// Get all approved memorandums
export const getPublicMemorandums = async (req, res, next) => {
  try {
    const memorandums = await Memorandum.find({ status: 'approved' }).sort({ uploadedAt: -1 });
    res.json(memorandums);
  } catch (error) {
    next(error);
  }
};

