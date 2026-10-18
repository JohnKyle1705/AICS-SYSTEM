/**
 * Next.js Instrumentation Hook (runs once on server startup).
 *
 * Suppresses harmless ECONNRESET / "aborted" errors that occur when the
 * browser closes a socket mid-request (e.g. after window.location.href
 * redirects while a keepalive fetch is still in-flight). These are not
 * real server errors and should not appear as uncaughtException noise.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    process.on('uncaughtException', (err: NodeJS.ErrnoException) => {
      // Silence ECONNRESET (browser aborted) and ERR_HTTP_HEADERS_SENT
      // (response already finished). Both are harmless in this context.
      if (
        err.code === 'ECONNRESET' ||
        err.code === 'ERR_HTTP_HEADERS_SENT' ||
        err.message === 'aborted' ||
        err.message?.includes('aborted')
      ) {
        return // silently swallow
      }
      // Re-throw everything else so real errors still crash the process
      console.error('[uncaughtException]', err)
      process.exit(1)
    })

    process.on('unhandledRejection', (reason: unknown) => {
      if (
        reason instanceof Error &&
        (reason.message === 'aborted' || (reason as NodeJS.ErrnoException).code === 'ECONNRESET')
      ) {
        return // silently swallow
      }
      console.error('[unhandledRejection]', reason)
    })
  }
}
