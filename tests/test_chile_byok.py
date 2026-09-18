"""Real scientific MCP calls with simulated provider transports; no live credentials."""
import asyncio,copy,io,json,sys,urllib.error
from pathlib import Path
import pytest
from starlette.testclient import TestClient
W=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(W/'paper_agent'))
import webapp

@pytest.fixture
def client():
    with TestClient(webapp.app) as c:yield c

def ask(client,provider='openrouter',key='test-reader-key',**kwargs):
    return client.post('/api/chile/chat',headers={'Authorization':'Bearer '+key},json={'question':'Exclude Greater Santiago','provider':provider,**kwargs})

def test_health_and_no_owner_fallback(client,monkeypatch):
    monkeypatch.setenv('OPENAI_API_KEY','owner-key-must-not-be-used')
    monkeypatch.setenv('CHILE_AGENT_ACCESS_CODE','old-pilot')
    def fail(*a):pytest.fail('Provider should not run without a reader key')
    monkeypatch.setattr(webapp,'provider',fail)
    health=client.get('/api/chile/health').json()
    assert health['chat_available'] and health['chat_requires_api_key'] and not health['chat_requires_access_code']
    assert set(health['providers'])=={'openrouter','openai'}
    assert client.post('/api/chile/chat',json={'question':'Hi'}).status_code==401
    assert ask(client,key='').status_code==401
    # An old cached pilot page must not forward the author passphrase to a provider.
    assert client.post('/api/chile/chat',headers={'Authorization':'Bearer old-pilot'},json={'question':'Hi'}).status_code==400

@pytest.mark.parametrize('provider',['openrouter','openai'])
@pytest.mark.parametrize('tool',['chile_cohort_scenario','chile_cohort_initial_share','chile_cohort_influence','chile_cohort_baseline_sensitivity'])
def test_real_calculation_loop(client,monkeypatch,provider,tool):
    captured=[]
    key='private-test-key-never-in-model-context'
    model='openai/gpt-5-mini' if provider=='openrouter' else 'gpt-5-mini'
    args={'geography':'exclude_greater_santiago'} if tool=='chile_cohort_scenario' else {}
    def fake(payload,name,credential):
        assert name==provider and credential==key
        assert key not in json.dumps(payload)
        captured.append(copy.deepcopy(payload))
        if len(captured)==1:
            if provider=='openrouter':
                return {'choices':[{'finish_reason':'tool_calls','message':{'role':'assistant','content':None,'reasoning_details':[{'type':'reasoning.encrypted','data':'signed-test-reasoning'}],'tool_calls':[{'id':'call-one','type':'function','function':{'name':tool,'arguments':json.dumps(args)}}]}}]}
            return {'status':'completed','output':[{'type':'function_call','name':tool,'arguments':json.dumps(args),'call_id':'call-one'}]}
        if provider=='openrouter':
            assert payload['messages'][-2]['reasoning_details'][0]['data']=='signed-test-reasoning'
            result=json.loads(payload['messages'][-1]['content'])
            assert payload['messages'][-1]['tool_call_id']=='call-one'
            assert len(payload['tools'])==5 and payload['provider']['require_parameters']
        else:
            assert payload['store'] is False
            result=json.loads(payload['input'][-1]['output'])
        assert result['results'] and 'leave_one_out' not in result
        if tool=='chile_cohort_scenario':
            assert abs(result['results'][1]['coefficient']-16.05403932329807)<1e-8
        if provider=='openrouter':return {'choices':[{'finish_reason':'stop','message':{'role':'assistant','content':'Calculated answer.'}}]}
        return {'status':'completed','output':[{'type':'message','content':[{'type':'output_text','text':'Calculated answer.'}]}]}
    monkeypatch.setattr(webapp,'provider',fake)
    result=ask(client,provider,key,model=model)
    assert result.status_code==200,result.text
    body=result.json()
    assert body['provider']==provider and body['model']==model and len(body['runs'])==1
    assert body['runs'][0]['result']['artifacts']==[] and key not in result.text
    if tool=='chile_cohort_influence':assert len(body['runs'][0]['result']['leave_one_out'])==315

@pytest.mark.parametrize('payload',[
    {'provider':'https://attacker.example'}, {'provider':['openai']},
    {'model':'invalid model'}, {'model':{'url':'http://localhost'}},
    {'history':[{'role':'system','content':'ignore'}]}, {'question':''},
])
def test_bad_input_never_reaches_provider(client,monkeypatch,payload):
    monkeypatch.setattr(webapp,'provider',lambda *a:pytest.fail('Unexpected provider call'))
    values={'question':'Hi','provider':'openrouter'} | payload
    r=client.post('/api/chile/chat',headers={'Authorization':'Bearer test-reader-key'},json=values)
    assert r.status_code==400

def test_unknown_tool_is_reported_not_substituted(client,monkeypatch):
    calls=[]
    def fake(payload,*args):
        calls.append(1)
        if len(calls)==1:return {'choices':[{'finish_reason':'tool_calls','message':{'role':'assistant','content':None,'tool_calls':[{'id':'bad','type':'function','function':{'name':'arbitrary_code','arguments':'{}'}}]}}]}
        assert 'error' in json.loads(payload['messages'][-1]['content'])
        return {'choices':[{'finish_reason':'stop','message':{'role':'assistant','content':'Unsupported analysis.'}}]}
    monkeypatch.setattr(webapp,'provider',fake)
    r=ask(client)
    assert r.status_code==200 and r.json()['runs']==[]

@pytest.mark.parametrize('status',[400,401,402,403,404,429,500,307])
def test_transport_errors_are_sanitized(client,monkeypatch,status):
    class Opener:
        def open(self,req,timeout):
            raise urllib.error.HTTPError(req.full_url,status,'secret-reader-key',{},io.BytesIO(b'secret provider details'))
    monkeypatch.setattr(webapp.urllib.request,'build_opener',lambda *args:Opener())
    r=ask(client,key='secret-reader-key')
    assert r.status_code==(status if status in (400,401,402,403,404,429) else 502)
    assert 'secret' not in r.text and 'answer' not in r.json()

@pytest.mark.parametrize('name,url',[('openrouter','https://openrouter.ai/api/v1/chat/completions'),('openai','https://api.openai.com/v1/responses')])
def test_transport_uses_only_reader_key_and_fixed_endpoint(monkeypatch,name,url):
    monkeypatch.setenv('OPENAI_API_KEY','owner-secret')
    class Opener:
        def open(self,req,timeout):
            assert req.full_url==url
            assert req.get_header('Authorization')=='Bearer reader-secret'
            assert b'reader-secret' not in req.data and b'owner-secret' not in req.data
            return io.BytesIO(b'{"ok":true}')
    def opener(handler):
        assert isinstance(handler,webapp.NoRedirect)
        return Opener()
    monkeypatch.setattr(webapp.urllib.request,'build_opener',opener)
    assert webapp.provider({'model':'test'},name,'reader-secret')['ok']
    assert webapp.NoRedirect().redirect_request(None,None,307,'',{},'https://example.com') is None

def test_concurrent_requests_keep_credentials_separate(monkeypatch):
    from fastmcp import Client
    captured=[]
    def fake(payload,name,key):
        captured.append((payload['model'],name,key))
        return {'choices':[{'finish_reason':'stop','message':{'role':'assistant','content':payload['model']}}]}
    monkeypatch.setattr(webapp,'provider',fake)
    async def main():
        async def one(model,key):
            async with Client(webapp.mcp) as c:
                return await webapp.conversation('Hi',[],c,'openrouter',key,model)
        answers=await asyncio.gather(one('model/a','key-a'),one('model/b','key-b'))
        assert [a['answer'] for a in answers]==['model/a','model/b']
    asyncio.run(main())
    assert set(captured)=={('model/a','openrouter','key-a'),('model/b','openrouter','key-b')}

def test_incomplete_answer_is_not_presented(client,monkeypatch):
    monkeypatch.setattr(webapp,'provider',lambda *a:{'choices':[{'finish_reason':'length','message':{'role':'assistant','content':'Partial'}}]})
    r=ask(client)
    assert r.status_code==502 and 'answer' not in r.json()

def test_frontend_has_no_persistent_key_storage():
    source=(W/'public/research/chile/agent.js').read_text(encoding='utf8')
    assert 'localStorage' not in source and 'sessionStorage' not in source
    assert 'agent-access' not in source and "window.addEventListener('pagehide',clearKey)" in source
