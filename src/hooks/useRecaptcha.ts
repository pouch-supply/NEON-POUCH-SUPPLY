import { useState, useEffect, useCallback, useRef } from 'react';

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

export const DEFAULT_SITE_KEY = '6LefWfspAAAAADsJ-68J39yGfE08JzW_0000000';

export function useRecaptcha() {
  const [siteKey, setSiteKey] = useState<string>(
    (import.meta as any).env?.VITE_RECAPTCHA_SITE_KEY || DEFAULT_SITE_KEY
  );
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const scriptLoadedRef = useRef<boolean>(false);

  // Fetch configured site key from backend settings if available
  useEffect(() => {
    let isMounted = true;
    fetch('/api/email/recaptcha-settings')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.siteKey && typeof data.siteKey === 'string' && data.siteKey.trim().length > 0) {
          setSiteKey(data.siteKey.trim());
        }
      })
      .catch((err) => {
        console.warn('[useRecaptcha] Could not fetch site key from backend settings:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Dynamically load Google reCAPTCHA v3 script
  useEffect(() => {
    if (!siteKey || scriptLoadedRef.current) return;

    // Check if script already in document
    const scriptId = 'google-recaptcha-v3-script';
    const existingScript = document.getElementById(scriptId);

    if (existingScript) {
      setIsLoaded(true);
      scriptLoadedRef.current = true;
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      setIsLoaded(true);
      scriptLoadedRef.current = true;
      console.log('[useRecaptcha] Google reCAPTCHA v3 script successfully loaded.');
    };

    script.onerror = () => {
      console.warn('[useRecaptcha] Failed to load Google reCAPTCHA script (adblocker or network error).');
      setError('Failed to load reCAPTCHA script.');
      setIsLoaded(true); // set loaded to true so executeRecaptcha can fallback gracefully
    };

    document.head.appendChild(script);
  }, [siteKey]);

  const executeRecaptcha = useCallback(
    async (action: string = 'submit'): Promise<string> => {
      if (!siteKey) {
        console.log('[useRecaptcha] No siteKey available, returning simulated token.');
        return `SIMULATED_RECAPTCHA_TOKEN_ACTION_${action}_${Date.now()}`;
      }

      // If grecaptcha exists on window
      if (typeof window !== 'undefined' && window.grecaptcha) {
        try {
          return await new Promise<string>((resolve) => {
            const timeout = setTimeout(() => {
              console.warn('[useRecaptcha] reCAPTCHA execution timed out, using fallback token.');
              resolve(`PASSED_LOCAL_TOKEN_${action}_${Date.now()}`);
            }, 4000);

            window.grecaptcha!.ready(() => {
              window.grecaptcha!
                .execute(siteKey, { action })
                .then((token) => {
                  clearTimeout(timeout);
                  resolve(token);
                })
                .catch((err) => {
                  clearTimeout(timeout);
                  console.warn('[useRecaptcha] grecaptcha.execute error:', err);
                  resolve(`PASSED_LOCAL_TOKEN_${action}_${Date.now()}`);
                });
            });
          });
        } catch (err) {
          console.warn('[useRecaptcha] Exception during executeRecaptcha:', err);
          return `PASSED_LOCAL_TOKEN_${action}_${Date.now()}`;
        }
      }

      // Fallback if grecaptcha is blocked by client
      return `PASSED_LOCAL_TOKEN_${action}_${Date.now()}`;
    },
    [siteKey]
  );

  return {
    siteKey,
    isLoaded,
    error,
    executeRecaptcha
  };
}
