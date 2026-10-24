const page = Bun.file(new URL('./index.html', import.meta.url));
const server = Bun.serve({
  hostname: '127.0.0.1',
  port: 8788,
  fetch(request) {
    const path = new URL(request.url).pathname;
    return path === '/' || path === '/index.html'
      ? new Response(page, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      : new Response('Not found', { status: 404 });
  }
});
console.log(`Pomodoro: ${server.url}`);
