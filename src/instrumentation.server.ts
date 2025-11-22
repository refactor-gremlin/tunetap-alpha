import * as Sentry from '@sentry/sveltekit';

Sentry.init({
  dsn: 'https://cdd8f2589e5ddf057d9fa086418439be@o4510404540628992.ingest.de.sentry.io/4510404543184976',

  tracesSampleRate: 1.0,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: import.meta.env.DEV,
});