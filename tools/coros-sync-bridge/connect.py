"""COROS OAuth probe, using the flow documented by coroslab/COROS-MCP.

No activity/Firebase writes. All local auth state uses Windows DPAPI.
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import secrets
import time
import urllib.error
import urllib.parse as url
import urllib.request as http

ROOT = Path(os.environ['LOCALAPPDATA']) / 'MyDash' / 'coros-sync'
ISSUERS = {'https://' + h for h in ('mcp.coros.com', 'mcpeu.coros.com', 'mcpus.coros.com', 'mcpcn.coros.com')}
REDIRECT = 'http://127.0.0.1:43123/callback'
SCOPE = 'openid offline_access mcp.tools'
READ_TOOLS = {'querySportRecords', 'getActivityDetail', 'queryActivityLapData'}


class Error(RuntimeError): pass


class NoRedirect(http.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl): return None


def request(endpoint, data=None, form=None, headers=None, post=False):
    parsed = url.urlsplit(endpoint)
    if f'{parsed.scheme}://{parsed.netloc}' not in ISSUERS:
        raise Error('Unexpected COROS endpoint')
    headers = dict(headers or {})
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        headers['Content-Type'] = 'application/json'
    if form is not None:
        body = url.urlencode(form).encode()
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
    req = http.Request(endpoint, data=body, headers=headers, method='POST' if post or body is not None else 'GET')
    try:
        response = http.build_opener(NoRedirect()).open(req, timeout=25)
    except urllib.error.HTTPError as exc: response = exc
    except urllib.error.URLError: raise Error('COROS network connection failed') from None
    with response:
        status, hdr, raw = response.status, response.headers, response.read().decode()
    if status in (301, 302, 303, 307, 308): return status, hdr, {}
    if status >= 400: raise Error(f'COROS HTTP {status}; response body withheld')
    if 'text/event-stream' in hdr.get('Content-Type', ''):
        events = []
        for block in raw.replace('\r\n', '\n').split('\n\n'):
            value = '\n'.join(line[5:].lstrip() for line in block.splitlines() if line.startswith('data:'))
            if value: events.append(json.loads(value))
        payload = next((e for e in reversed(events) if 'result' in e or 'error' in e), {})
    else: payload = json.loads(raw) if raw else {}
    return status, hdr, payload


def save(name, value):
    import win32crypt
    ROOT.mkdir(parents=True, exist_ok=True)
    encrypted = win32crypt.CryptProtectData(json.dumps(value).encode(), 'MyDash COROS', None, None, None, 0)
    target = ROOT / (name + '.enc')
    temporary = target.with_suffix('.tmp')
    temporary.write_bytes(encrypted)
    temporary.replace(target)


def load(name):
    import win32crypt
    target = ROOT / (name + '.enc')
    if not target.exists(): raise Error('COROS login required')
    return json.loads(win32crypt.CryptUnprotectData(target.read_bytes(), None, None, None, 0)[1])


def start():
    _, _, discovery = request('https://mcp.coros.com/.well-known/openid-configuration')
    issuer = discovery.get('issuer', 'https://mcp.coros.com').rstrip('/')
    if issuer not in ISSUERS: raise Error('Unexpected COROS issuer')
    _, _, registration = request(issuer + '/connect/register', data={
        'client_name': 'MyDash COROS Sync', 'redirect_uris': [REDIRECT],
        'grant_types': ['authorization_code', 'refresh_token'], 'response_types': ['code'],
        'scope': SCOPE, 'token_endpoint_auth_method': 'none'})
    client = registration['client_id']
    verifier, state = secrets.token_urlsafe(32), secrets.token_urlsafe(24)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')
    _, _, session = request(issuer + '/api/v1/cli/login-sessions', data={'clientId': client})
    login = url.urlsplit(session['loginUrl'])
    if login.scheme != 'https' or not (login.hostname == 'coros.com' or (login.hostname or '').endswith('.coros.com')):
        raise Error('Unexpected login host')
    authorize = issuer + '/oauth2/authorize?' + url.urlencode({
        'response_type': 'code', 'client_id': client, 'redirect_uri': REDIRECT, 'scope': SCOPE,
        'code_challenge': challenge, 'code_challenge_method': 'S256', 'resource': issuer + '/mcp', 'state': state})
    save('pending', dict(issuer=issuer, client=client, verifier=verifier, state=state, authorize=authorize, session=session))
    print(session['loginUrl'], flush=True)


def store_token(issuer, client, value, previous=None):
    if not value.get('access_token'): raise Error('Missing access token')
    value['refresh_token'] = value.get('refresh_token') or (previous or {}).get('refresh_token')
    if not value['refresh_token']: raise Error('Missing refresh token')
    value.update(issuer=issuer, client=client, expires_at=time.time() + int(value.get('expires_in', 3600)))
    save('token', value)
    return value


def finish():
    pending = load('pending')
    session, issuer = pending['session'], pending['issuer']
    _, _, claimed = request(issuer + '/api/v1/cli/login-sessions/' + url.quote(session['sessionId'], safe='') + '/claim',
                           post=True, headers={'X-Poll-Token': session['pollToken']})
    if claimed.get('status') != 'authorized': raise Error('Login status: ' + str(claimed.get('status', 'unknown')))
    status, headers, _ = request(pending['authorize'] + '&' + url.urlencode({'login_ticket': claimed['loginTicket']}))
    callback = url.urlsplit(headers.get('Location', ''))
    if status not in (302, 303) or callback._replace(query='', fragment='').geturl() != REDIRECT:
        raise Error('Unexpected OAuth callback')
    query = url.parse_qs(callback.query)
    if query.get('state', [''])[0] != pending['state'] or not query.get('code'): raise Error('Invalid OAuth state/code')
    _, _, value = request(issuer + '/oauth2/token', form={
        'grant_type': 'authorization_code', 'client_id': pending['client'], 'code': query['code'][0],
        'redirect_uri': REDIRECT, 'code_verifier': pending['verifier']})
    store_token(issuer, pending['client'], value)
    (ROOT / 'pending.enc').unlink(missing_ok=True)
    print('COROS connected; credentials encrypted with Windows DPAPI.')


def get_token():
    cached = load('token')
    if time.time() + 60 < cached['expires_at']: return cached
    _, _, value = request(cached['issuer'] + '/oauth2/token', form={
        'grant_type': 'refresh_token', 'client_id': cached['client'], 'refresh_token': cached['refresh_token']})
    return store_token(cached['issuer'], cached['client'], value, cached)


def rpc(auth, method, params, ident):
    _, _, payload = request(auth['issuer'] + '/mcp', headers={
        'Authorization': 'Bearer ' + auth['access_token'], 'Accept': 'application/json, text/event-stream'},
        data={'jsonrpc': '2.0', 'id': ident, 'method': method, 'params': params})
    if 'error' in payload or 'result' not in payload: raise Error('MCP request failed: ' + method)
    return payload['result']


def probe(tool=None, arguments=None):
    auth = get_token()
    rpc(auth, 'initialize', {'protocolVersion': '2025-06-18', 'capabilities': {},
                            'clientInfo': {'name': 'MyDash COROS Sync', 'version': '0.1.0'}}, 1)
    if tool:
        if tool not in READ_TOOLS: raise Error('Only activity read tools allowed')
        result = rpc(auth, 'tools/call', {'name': tool, 'arguments': arguments or {}}, 2)
        if result.get('isError'): raise Error('Activity read rejected; response body withheld')
        save('last-activity-probe', result)
        print('Activity response saved encrypted locally for schema validation.')
        return
    cursor, seen, catalog = None, set(), []
    while True:
        result = rpc(auth, 'tools/list', {'cursor': cursor} if cursor else {}, len(seen) + 2)
        catalog.extend(t for t in result.get('tools', []) if t.get('name') in READ_TOOLS)
        cursor = result.get('nextCursor')
        if not cursor: break
        if cursor in seen or len(seen) >= 100: raise Error('Invalid catalog pagination')
        seen.add(cursor)
    print(json.dumps(catalog, indent=2, ensure_ascii=True))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['login-start', 'login-finish', 'status', 'tools', 'probe'])
    parser.add_argument('--tool', choices=sorted(READ_TOOLS))
    parser.add_argument('--arguments', default='{}')
    args = parser.parse_args()
    try:
        if args.command == 'login-start': start()
        elif args.command == 'login-finish': finish()
        elif args.command == 'status': print('Token present' if (ROOT / 'token.enc').exists() else 'Login required')
        elif args.command == 'tools': probe()
        else:
            if not args.tool: raise Error('--tool required')
            arguments = json.loads(args.arguments)
            if not isinstance(arguments, dict): raise Error('Arguments must be an object')
            probe(args.tool, arguments)
    except (Error, KeyError, ValueError, OSError) as exc:
        print(str(exc) if isinstance(exc, Error) else 'Invalid or inaccessible connection state; private data withheld.')
        return 1
    return 0


if __name__ == '__main__': raise SystemExit(main())
