const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getTrackers,
  getTrackerByProject,
  createTracker,
  updateTracker,
  updateSingleMilestone,
  deleteTracker,
  bulkUploadTrackers,
  exportTrackers
} = require('../controllers/milestoneTrackerController');
const { protect, checkPermission } = require('../middlewares/authMiddleware');

const financeAccess = checkPermission('financeAccess');
const directorAccess = (req, res, next) => {
  const roleName = req.user?.role?.name;
  if (roleName === 'Director' || req.user?.role?.permissions?.systemConfiguration === true) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Director role required.' });
};

// Multer in-memory storage for Excel/CSV upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Bulk Upload & Export
router.post('/bulk-upload', protect, financeAccess, upload.single('file'), bulkUploadTrackers);
router.get('/export', protect, financeAccess, exportTrackers);

// CRUD
router.route('/')
  .get(protect, financeAccess, getTrackers)
  .post(protect, financeAccess, createTracker);

router.route('/:projectId')
  .get(protect, financeAccess, getTrackerByProject)
  .put(protect, financeAccess, updateTracker)
  .delete(protect, directorAccess, deleteTracker);

router.put('/:projectId/milestone/:milestoneNumber', protect, financeAccess, updateSingleMilestone);

module.exports = router;
