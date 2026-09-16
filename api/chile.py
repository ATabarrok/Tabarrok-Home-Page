from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"paper_agent"))
from webapp import app
from starlette.routing import Route

# Vercel adds trailing slashes site-wide. Register both URL forms directly
# on the ASGI application so the platform and Starlette cannot redirect
# back and forth. Leave the mounted MCP application's routes intact.
for route in list(app.routes):
    if isinstance(route, Route) and not route.path.endswith('/'):
        app.router.routes.append(Route(route.path+'/', route.endpoint, methods=route.methods))
