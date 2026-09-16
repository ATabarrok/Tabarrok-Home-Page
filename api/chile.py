from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"paper_agent"))
from webapp import app as application

async def app(scope, receive, send):
    # Vercel adds trailing slashes site-wide; avoid a redirect back and forth
    # with the API's canonical slashless routes. Keep the MCP mount intact.
    if scope['type'] == 'http' and scope['path'] in {
        '/api/chile/health/', '/api/chile/analyze/', '/api/chile/chat/'
    }:
        scope = dict(scope, path=scope['path'].rstrip('/'))
        scope['raw_path'] = scope['path'].encode('ascii')
    await application(scope, receive, send)
