import unittest
from unittest.mock import patch
import connect


class ConnectionTests(unittest.TestCase):
    def test_reject_untrusted_endpoint_before_network(self):
        for endpoint in ('http://mcpus.coros.com/mcp', 'https://mcpus.coros.com.evil.test/mcp', 'https://user@mcpus.coros.com/mcp'):
            with self.assertRaises(connect.Error): connect.request(endpoint)

    def test_refresh_keeps_previous_refresh_token_when_not_rotated(self):
        with patch.object(connect, 'save') as save:
            result = connect.store_token('https://mcpus.coros.com', 'client',
                                         {'access_token': 'new', 'expires_in': 300}, {'refresh_token': 'old'})
            self.assertEqual(result['refresh_token'], 'old')
            self.assertGreater(result['expires_at'], connect.time.time())
            save.assert_called_once()

    def test_invalid_token_not_saved(self):
        with patch.object(connect, 'save') as save:
            with self.assertRaises(connect.Error):
                connect.store_token('https://mcpus.coros.com', 'client', {'access_token': 'new'})
            save.assert_not_called()

    def test_state_mismatch_never_exchanges_or_saves_token(self):
        pending = dict(issuer='https://mcpus.coros.com', state='expected', authorize='https://mcpus.coros.com/oauth2/authorize?a=b',
                       session={'sessionId': 'test', 'pollToken': 'test'})
        responses = [(200, {}, {'status': 'authorized', 'loginTicket': 'test'}),
                     (302, {'Location': connect.REDIRECT + '?code=test&state=wrong'}, {})]
        with patch.object(connect, 'load', return_value=pending), patch.object(connect, 'request', side_effect=responses) as req, patch.object(connect, 'save') as save:
            with self.assertRaises(connect.Error): connect.finish()
            self.assertEqual(req.call_count, 2)
            save.assert_not_called()

    def test_repeated_catalog_cursor_stops(self):
        page = {'tools': [], 'nextCursor': 'same'}
        with patch.object(connect, 'get_token', return_value={}), patch.object(connect, 'rpc', side_effect=[{}, page, page]):
            with self.assertRaises(connect.Error): connect.probe()

    def test_expired_token_refreshes_once(self):
        old = dict(issuer='https://mcpus.coros.com', client='test', refresh_token='old', expires_at=0)
        with patch.object(connect, 'load', return_value=old), patch.object(connect, 'request', return_value=(200, {}, {'access_token': 'new', 'refresh_token': 'rotated'})) as req, patch.object(connect, 'save'):
            result = connect.get_token()
            self.assertEqual(result['refresh_token'], 'rotated')
            req.assert_called_once()


if __name__ == '__main__': unittest.main()
