const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const ctl = require('../controllers/analysis.controller');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, uploadDir),
    filename: (_, file, cb) => {
        const safe = file.originalname.replace(/[^a-z0-9.\-_]/gi, '_');
        cb(null, `${Date.now()}-${safe}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 },        // 25 MB per file
    fileFilter: (req, file, cb) => {
        const isDeck = file.fieldname === 'deck';
        const isFin  = file.fieldname === 'financials';
        const ok = (isDeck && file.mimetype === 'application/pdf')
                || (isFin  && (file.mimetype === 'application/pdf'
                            || file.mimetype === 'application/vnd.ms-excel'
                            || file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
        if (!ok) return cb(new Error(`unsupported file type for ${file.fieldname}: ${file.mimetype}`));
        cb(null, true);
    }
});

router.post(
    '/',
    authenticate,
    upload.fields([
        { name: 'deck',       maxCount: 1 },
        { name: 'financials', maxCount: 1 }
    ]),
    ctl.createAnalysis
);

router.get('/', authenticate, ctl.listAnalyses);
router.get('/:id', authenticate, ctl.getAnalysis);
router.put('/:id/deviations/:devId', authenticate, ctl.updateDeviation);

module.exports = router;
