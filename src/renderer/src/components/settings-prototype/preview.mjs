// Throwaway UI study. Serves one self-contained document; never touches the launcher API.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
const html = await readFile(new URL('./index.html', import.meta.url))
const server = createServer((req, res) => {
  if (req.url !== '/' && !req.url?.startsWith('/?')) {
    res.writeHead(404).end('Not found')
    return
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(html)
})
server.listen(8347, '127.0.0.1', () => console.log('UAC settings study: http://127.0.0.1:8347'))
