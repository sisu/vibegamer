// Shared helper for rendering games in a sandboxed iframe document.

export function buildFrameHtml(code) {
  // Prevent </script> in game code from breaking the HTML document.
  const safeCode = code.replace(/<\/script/gi, '<\\/script');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #000; }
    canvas { display: block; }
  </style>
  <script src="/engine/kaboom.js"></script>
</head>
<body>
  <script>
${safeCode}
  </script>
</body>
</html>`;
}

export const FRAME_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src *",
    "media-src *",
    "connect-src 'none'",
    "frame-ancestors 'self'",
  ].join('; '),
  'X-Frame-Options': 'SAMEORIGIN',
  'Cache-Control': 'no-store',
};
