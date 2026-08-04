import { Router, Request, Response } from 'express';
import {
  getAgeCheckedSettings,
  saveAgeCheckedSettings,
  testAgeCheckedConnection,
  verifyCustomerAge,
  getAgeCheckedAuditLogs
} from '../services/ageCheckedService';

const router = Router();

/**
 * GET /api/agechecked/config
 * Returns public configuration for storefront verification
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    const settings = await getAgeCheckedSettings();
    // Sanitize credentials out of public config route
    const { password, secretKey, ...publicConfig } = settings;
    res.json({ success: true, config: publicConfig });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/agechecked/config
 * Admin route to update AgeChecked configuration
 */
router.post('/config', async (req: Request, res: Response) => {
  try {
    const updated = await saveAgeCheckedSettings(req.body);
    res.json({ success: true, settings: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/agechecked/test
 * Test API connection with AgeChecked Staging or Live endpoint
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const result = await testAgeCheckedConnection(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/agechecked/verify
 * Perform age verification check for customer checkout
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const result = await verifyCustomerAge(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      verified: false,
      status: 'ERROR',
      reason: err.message || 'Internal verification server error'
    });
  }
});

/**
 * GET /api/agechecked/audit-logs
 * Get list of verification attempts for admin audit
 */
router.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const logs = getAgeCheckedAuditLogs();
    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
