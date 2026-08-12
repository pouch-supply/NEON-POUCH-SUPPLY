import { Router, Request, Response } from 'express';
import { fetchResource, saveResource } from '../../serverDb';
import { sendWelcomeEmail } from '../services/emailService';

const router = Router();

// Endpoint to generate Google OAuth Authorization URL
router.get('/google/url', (req: Request, res: Response) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.OAUTH_CLIENT_ID || '';
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'https';
    
    // Construct dynamic redirect URI matching request host
    const redirectUri = `${protocol}://${host}/auth/google/callback`;

    if (!clientId) {
      // Return configured indicator if client ID is missing
      return res.json({
        configured: false,
        message: 'GOOGLE_CLIENT_ID environment variable is not configured.',
        redirectUri
      });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account'
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return res.json({
      configured: true,
      url,
      redirectUri
    });
  } catch (err: any) {
    console.error('[Google OAuth] Error generating Auth URL:', err);
    return res.status(500).json({ error: 'Failed to generate Google auth URL' });
  }
});

// Endpoint to verify Google OAuth Bearer Token / Access Token directly from client
router.post('/google/verify', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const { accessToken, idToken } = req.body;
    const token = (authHeader && authHeader.startsWith('Bearer '))
      ? authHeader.slice(7)
      : (accessToken || idToken);

    if (!token) {
      return res.status(400).json({ error: 'OAuth token missing in request.' });
    }

    // Call Google UserInfo API
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });

    const googleUser = await userRes.json();

    if (!userRes.ok || !googleUser || !googleUser.email) {
      return res.status(401).json({ error: 'Invalid or expired Google OAuth token.' });
    }

    const emailTrim = googleUser.email.trim().toLowerCase();
    const customerName = googleUser.name || googleUser.given_name || emailTrim.split('@')[0];
    const picture = googleUser.picture || '';

    // Find or create customer
    const customersList = await fetchResource('customers');
    let found: any = customersList.find((c: any) => c.email.toLowerCase() === emailTrim);

    if (found) {
      found.emailVerified = true;
      found.emailVerifiedAt = found.emailVerifiedAt || new Date().toISOString();
      if (picture && !found.avatarUrl) found.avatarUrl = picture;
      if (googleUser.id) found.googleId = googleUser.id;
    } else {
      found = {
        id: `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: customerName,
        email: emailTrim,
        subscriptionStatus: 'Not subscribed',
        location: 'United Kingdom',
        ordersCount: 0,
        amountSpent: 0,
        addresses: ['United Kingdom'],
        wishlist: [],
        emailVerified: true,
        emailVerifiedAt: new Date().toISOString(),
        avatarUrl: picture,
        googleId: googleUser.id,
        referralCode: `POUCH-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        storeCredit: 0
      };
      customersList.unshift(found);
      sendWelcomeEmail(emailTrim, customerName, found.referralCode).catch(e => console.warn('Welcome email error:', e));
    }

    await saveResource('customers', customersList);
    const { passwordHash, ...safeCustomer } = found;

    return res.json({ success: true, customer: safeCustomer });
  } catch (err: any) {
    console.error('[Google OAuth Verify Error]', err);
    return res.status(500).json({ error: 'Failed to verify Google authentication token.' });
  }
});

// OAuth Callback Handler (handles GET /auth/google/callback)
export async function handleGoogleOAuthCallback(req: Request, res: Response) {
  const { code, error } = req.query;

  if (error) {
    return res.send(`
      <!DOCTYPE html>
      <html>
        <body style="font-family: system-ui; padding: 20px; text-align: center;">
          <h3 style="color: #e11d48;">Google Sign-In Cancelled or Failed</h3>
          <p>${error}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: '${error}' }, '*');
              setTimeout(() => window.close(), 2000);
            }
          </script>
        </body>
      </html>
    `);
  }

  if (!code || typeof code !== 'string') {
    return res.status(400).send('Authorization code missing.');
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.OAUTH_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.OAUTH_CLIENT_SECRET || '';
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'https';
    const redirectUri = `${protocol}://${host}/auth/google/callback`;

    // 1. Exchange authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[Google OAuth Token Error]', tokenData);
      throw new Error(tokenData.error_description || 'Failed to obtain access token from Google');
    }

    // 2. Fetch user profile from Google UserInfo API
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const googleUser = await userRes.json();

    if (!googleUser || !googleUser.email) {
      throw new Error('Could not fetch user profile from Google');
    }

    const emailTrim = googleUser.email.trim().toLowerCase();
    const customerName = googleUser.name || googleUser.given_name || emailTrim.split('@')[0];
    const picture = googleUser.picture || '';

    // 3. Find or create customer record in database
    const customersList = await fetchResource('customers');
    let found: any = customersList.find((c: any) => c.email.toLowerCase() === emailTrim);

    if (found) {
      found.emailVerified = true;
      found.emailVerifiedAt = found.emailVerifiedAt || new Date().toISOString();
      if (picture && !found.avatarUrl) found.avatarUrl = picture;
      if (googleUser.id) found.googleId = googleUser.id;
      if (!found.referralCode) {
        found.referralCode = `POUCH-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      }
    } else {
      found = {
        id: `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: customerName,
        email: emailTrim,
        subscriptionStatus: 'Not subscribed',
        location: 'United Kingdom',
        ordersCount: 0,
        amountSpent: 0,
        addresses: ['United Kingdom'],
        wishlist: [],
        emailVerified: true,
        emailVerifiedAt: new Date().toISOString(),
        avatarUrl: picture,
        googleId: googleUser.id,
        referralCode: `POUCH-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        storeCredit: 0
      };
      customersList.unshift(found);
      
      // Dispatch welcome email ONCE for new customer registration
      sendWelcomeEmail(emailTrim, customerName, found.referralCode).catch(e => console.warn('Welcome email error:', e));
    }

    await saveResource('customers', customersList);

    const { passwordHash, ...safeCustomer } = found;

    // 4. Send success postMessage and close popup window
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Google Sign-In Successful</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #0f172a; }
            .card { background: white; padding: 32px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); text-align: center; max-width: 360px; border: 1px solid #e2e8f0; }
            .check { width: 48px; h-48px; background: #dcfce7; color: #15803d; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 24px; }
            h2 { font-size: 18px; margin: 0 0 8px; font-weight: 700; }
            p { font-size: 13px; color: #64748b; margin: 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="check">✓</div>
            <h2>Signed in as ${customerName}</h2>
            <p>Authentication complete. Returning to Pouch Supply...</p>
          </div>
          <script>
            try {
              if (window.opener) {
                window.opener.postMessage({
                  type: 'OAUTH_AUTH_SUCCESS',
                  customer: ${JSON.stringify(safeCustomer)}
                }, '*');
                setTimeout(() => window.close(), 600);
              } else {
                window.location.href = '/';
              }
            } catch(e) {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);

  } catch (err: any) {
    console.error('[Google OAuth Callback Error]', err);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <body style="font-family: system-ui; padding: 20px; text-align: center;">
          <h3 style="color: #e11d48;">Authentication Failed</h3>
          <p>${err.message || 'An unexpected error occurred during Google authentication.'}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: '${err.message || 'Auth failed'}' }, '*');
            }
          </script>
        </body>
      </html>
    `);
  }
}

export default router;
