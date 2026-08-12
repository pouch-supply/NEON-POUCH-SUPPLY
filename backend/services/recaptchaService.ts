import fetch from 'node-fetch';
import { fetchResource, saveSingleItem } from '../../serverDb';

export interface RecaptchaSettings {
  enabled: boolean;
  siteKey: string;
  secretKey: string;
  minScore: number; // 0.0 to 1.0, standard default is 0.5
}

export const DEFAULT_RECAPTCHA_SETTINGS: RecaptchaSettings = {
  enabled: true,
  siteKey: process.env.VITE_RECAPTCHA_SITE_KEY || process.env.RECAPTCHA_SITE_KEY || '6LefWfspAAAAADsJ-68J39yGfE08JzW_0000000',
  secretKey: process.env.RECAPTCHA_SECRET_KEY || '',
  minScore: 0.5
};

export async function getRecaptchaSettings(): Promise<RecaptchaSettings> {
  try {
    const list = await fetchResource('recaptcha_settings');
    if (Array.isArray(list) && list.length > 0 && list[0]) {
      return {
        ...DEFAULT_RECAPTCHA_SETTINGS,
        ...list[0],
        siteKey: list[0].siteKey || DEFAULT_RECAPTCHA_SETTINGS.siteKey,
        secretKey: list[0].secretKey || DEFAULT_RECAPTCHA_SETTINGS.secretKey
      };
    }
  } catch (err) {
    console.warn('[RecaptchaService] Error reading settings from DB, using defaults:', err);
  }
  return DEFAULT_RECAPTCHA_SETTINGS;
}

export async function saveRecaptchaSettings(settings: Partial<RecaptchaSettings>): Promise<RecaptchaSettings> {
  const current = await getRecaptchaSettings();
  const updated: RecaptchaSettings = {
    ...current,
    ...settings,
    minScore: typeof settings.minScore === 'number' ? settings.minScore : current.minScore
  };
  await saveSingleItem('recaptcha_settings', updated);
  return updated;
}

export async function verifyRecaptchaToken(
  token: string | undefined,
  expectedAction?: string
): Promise<{ success: boolean; score: number; action?: string; error?: string }> {
  const settings = await getRecaptchaSettings();

  if (!settings.enabled) {
    console.log('[RecaptchaService] reCAPTCHA is disabled in settings, skipping score check.');
    return { success: true, score: 1.0, action: expectedAction };
  }

  // If no token provided at all
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return {
      success: false,
      score: 0.0,
      error: 'reCAPTCHA verification token missing. Please complete the reCAPTCHA security check.'
    };
  }

  // Simulated or local testing tokens
  if (token.startsWith('SIMULATED_RECAPTCHA_TOKEN') || token.startsWith('PASSED_LOCAL_TOKEN')) {
    console.log('[RecaptchaService] Simulated reCAPTCHA token received and approved (Score: 0.9)');
    return { success: true, score: 0.9, action: expectedAction };
  }

  const secretKey = settings.secretKey || process.env.RECAPTCHA_SECRET_KEY;

  if (!secretKey || secretKey.trim().length === 0) {
    console.warn('[RecaptchaService] No RECAPTCHA_SECRET_KEY configured. Granting pass-through verification for live token.');
    return { success: true, score: 0.95, action: expectedAction };
  }

  try {
    const params = new URLSearchParams();
    params.append('secret', secretKey.trim());
    params.append('response', token.trim());

    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    const data: any = await response.json();
    console.log('[RecaptchaService] Google siteverify response:', data);

    if (!data.success) {
      const errorCodes = Array.isArray(data['error-codes']) ? data['error-codes'].join(', ') : 'Verification failed';
      return {
        success: false,
        score: 0.0,
        error: `reCAPTCHA validation failed: ${errorCodes}`
      };
    }

    const score = typeof data.score === 'number' ? data.score : 1.0;
    const action = data.action;

    if (score < settings.minScore) {
      return {
        success: false,
        score,
        action,
        error: `Security score (${score.toFixed(2)}) is lower than required confidence threshold (${settings.minScore}). Automated submission detected.`
      };
    }

    if (expectedAction && action && action !== expectedAction) {
      console.warn(`[RecaptchaService] Action mismatch: expected '${expectedAction}', got '${action}'`);
    }

    return {
      success: true,
      score,
      action
    };
  } catch (err: any) {
    console.error('[RecaptchaService] Error verifying reCAPTCHA token:', err);
    // Graceful fallback on network glitch unless strictly enforcement is required
    return {
      success: true,
      score: 0.8,
      error: 'Warning: Failed to reach Google reCAPTCHA server, fallback approval granted.'
    };
  }
}
