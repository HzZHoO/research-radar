import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('public');
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.xml':'application/atom+xml','.md':'text/plain; charset=utf-8'};
http.createServer(async(req,res)=> {
  try {
    const url=new URL(req.url,'http://localhost');
    const filename=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!filename.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    const content=await fs.readFile(filename);res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream'});res.end(content);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(8787,'127.0.0.1',()=>console.log('RSI radar: http://127.0.0.1:8787'));
