const express = require('express');
const { calculate, getHistory, getMix, exportPDF, exportExcel } = require('../controllers/mixController');
const auth = require('../middleware/auth');
const { body } = require('express-validator');

const router = express.Router({ mergeParams: true });

// Protected routes
router.use(auth);

router.post('/calculate', [
  body('grade').matches(/M[3-6][0-9]/),
  body('slump').isNumeric().toInt(),
  // etc
], calculate);

router.get('/history', getHistory);
router.get('/:id', getMix);
router.get('/:id/pdf', exportPDF);
router.get('/:id/excel', exportExcel);

module.exports = router;

