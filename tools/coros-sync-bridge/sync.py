"""Bounded COROS running sync. Dry-run by default; --apply enables MyDash writes."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from html import escape
import json
import math
import msvcrt
import os
import re
import shutil
import subprocess
import tempfile
import time
import connect

ICT = timezone(timedelta(hours=7))
PROJECT = 'dash-ca315'
INSTANCE = 'dash-ca315-default-rtdb'


def unpack(result):
    if result.get('isError'): raise connect.Error('COROS tool returned an error')
    blocks = [b['text'] for b in result.get('content', []) if b.get('type') == 'text']
    if len(blocks) != 1: raise connect.Error('Unexpected COROS response envelope')
    value = blocks[0]
    for _ in range(3):
        if not isinstance(value, str): break
        try: value = json.loads(value)
        except ValueError: break
    return value


def seconds(value):
    parts = [int(n) for n in value.split(':')]
    if len(parts) not in (2, 3) or any(n < 0 for n in parts) or any(n >= 60 for n in parts[1:]):
        raise connect.Error('Unknown COROS duration format')
    total = 0
    for n in parts: total = total * 60 + n
    return total


def records(result):
    text = unpack(result)
    if not isinstance(text, str): raise connect.Error('COROS record format changed')
    if re.fullmatch(r'No sport records found from \d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}\.', text): return []
    header = re.search(r'\((\d+) records\)', text)
    if not header: raise connect.Error('Missing COROS record count; no writes performed')
    count = int(header[1])
    if count >= 200: raise connect.Error('COROS daily result limit reached; refusing partial sync')
    chunks = re.split(r'\n\d+\. ', text)[1:]
    if len(chunks) != count: raise connect.Error('Incomplete COROS record response')
    rows = []
    for chunk in chunks:
        date = re.search(r'— (\d{4}-\d{2}-\d{2})', chunk)
        # COROS has rendered the separator before this field differently across
        # clients.  Match the ISO date rather than that presentation character.
        date = re.search(r'\b(\d{4}-\d{2}-\d{2})\b', chunk)
        stamps = re.search(r'startTimestamp=(\d+) \| endTimestamp=(\d+)', chunk)
        summary = re.search(r'Duration: ([\d:]+) \| Distance: ([\d.]+) (km|m)\b', chunk)
        identity = re.search(r'Label\s*Id\s*:\s*(\d+).*?Sport\s*Type\s*:\s*(\d+)', chunk,
                             re.IGNORECASE | re.DOTALL)
        if not all((date, stamps, summary, identity)): raise connect.Error('Missing COROS identity/units')
        start, end = map(int, stamps.groups())
        dist, timer = float(summary[2]) / (1000 if summary[3] == 'm' else 1), seconds(summary[1])
        if dist <= 0 or end <= start or timer <= 0: raise connect.Error('Invalid COROS summary')
        hr = re.search(r'Avg HR: (\d+) bpm', chunk)
        rows.append(dict(id=identity[1], sportType=int(identity[2]), date=date[1], start=start, end=end,
                         dist=dist, timer=timer, hr=int(hr[1]) if hr else None))
    return rows


def positive(value):
    if isinstance(value, bool) or value is None: return None
    try: n = float(value)
    except (TypeError, ValueError): return None
    return n if math.isfinite(n) and n > 0 else None


def normalize(record, result):
    payload = unpack(result)
    if not isinstance(payload, dict) or str(payload.get('labelId')) != record['id']:
        raise connect.Error('Lap activity identity mismatch')
    if payload.get('sportType') != record['sportType']: raise connect.Error('Lap sport mismatch')
    # Live COROS contract: type 10 is the displayed kilometer split group,
    # distance=100000 represents 1 km; time/avgPace are seconds/seconds per km.
    groups = [g for g in payload.get('lapGroups', []) if g.get('type') == 10]
    if len(groups) != 1 or not groups[0].get('laps'): return None
    group = groups[0]
    if group.get('lapDistance') != 100000: raise connect.Error('Unexpected COROS split distance units')
    laps = []
    for i, raw in enumerate(group['laps'], 1):
        distance, duration, pace = positive(raw.get('distance')), positive(raw.get('time')), positive(raw.get('avgPace'))
        if not all((distance, duration, pace)) or raw.get('lapIndex') != i:
            raise connect.Error('Invalid or missing split data')
        km = distance / 100000
        if abs(duration / km - pace) > max(2, pace * .02): raise connect.Error('COROS split units failed pace cross-check')
        laps.append(dict(index=i, distanceKm=km, durationMin=duration/60, pace=duration/60/km,
                         averageHr=positive(raw.get('avgHr')), cadence=positive(raw.get('avgCadence')),
                         lapType='coros_distance_split'))
    if abs(sum(l['distanceKm'] for l in laps) - record['dist']) > .03:
        raise connect.Error('Split distances do not match the activity total')
    split_seconds = sum(l['durationMin'] * 60 for l in laps)
    elapsed = record['end'] - record['start']
    if abs(split_seconds - elapsed) > max(5, elapsed * .01):
        raise connect.Error('Split duration does not match activity time window')
    for lap in laps:
        for key in list(lap):
            if lap[key] is None: del lap[key]
    return dict(schemaVersion=1, source='coros', sourceId=record['id'], sportType=record['sportType'],
                startTimestamp=record['start'], endTimestamp=record['end'], groupType=10,
                durationBasis='coros_split_time', summaryTimerSeconds=record['timer'], elapsedSeconds=elapsed,
                laps=laps, coverage=dict(laps=True, map=False, streams=False))


def start_time(workout):
    values = [workout.get('startTimestamp'), workout.get('startTimeUtc')]
    intervals = (workout.get('healthConnectDetail') or {}).get('distanceIntervals') or []
    if isinstance(intervals, dict): intervals = list(intervals.values())
    if intervals: values.append(intervals[0].get('startTimeUtc'))
    for value in values:
        if value is None: continue
        try:
            if isinstance(value, (int,float)): return float(value)
            dt = datetime.fromisoformat(value.replace('Z','+00:00'))
            if dt.tzinfo: return dt.timestamp()
        except (ValueError, TypeError): pass
    return None


def match(record, workouts):
    linked, exact, close, possible = [], [], [], []
    for key, w in workouts.items():
        if not isinstance(w, dict): continue
        if (w.get('corosDetail') or {}).get('sourceId') == record['id'] or (w.get('source') == 'coros' and w.get('sourceId') == record['id']):
            linked.append(key)
        if w.get('date') != record['date'] or w.get('type') not in ('run','interval'): continue
        dist, minutes = positive(w.get('dist')), positive(w.get('time'))
        if not dist or not minutes: continue
        delta = abs(dist-record['dist'])
        duration_delta = min(abs(minutes*60-record['timer']), abs(minutes*60-(record['end']-record['start'])))
        if delta <= max(.35, record['dist']*.05) and duration_delta <= 210: possible.append(key)
        timestamp = start_time(w)
        if timestamp is not None:
            if abs(timestamp-record['start']) <= 5 and delta <= .03 and duration_delta <= 10: exact.append(key)
        elif delta <= .015 and duration_delta <= 6: close.append(key)
    for candidates in (linked, exact, close):
        if len(candidates) == 1: return candidates[0], 'matched'
        if len(candidates) > 1: return None, 'ambiguous'
    return (None, 'review') if possible else ('coros_' + record['id'], 'new')


def firebase(operation, path, value=None):
    executable = shutil.which('firebase.cmd') or os.path.join(os.environ['APPDATA'], 'npm', 'firebase.cmd')
    args = [executable, 'database:' + operation, path, '--project', PROJECT, '--instance', INSTANCE, '--non-interactive']
    temporary = None
    try:
        if value is not None:
            with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',suffix='.json',prefix='firebase-',dir=connect.ROOT,delete=False) as handle:
                temporary = handle.name
                json.dump(value,handle,allow_nan=False)
            args.insert(3, temporary)
            args.append('--force')
        result = subprocess.run(args, capture_output=True, text=True, encoding='utf-8', timeout=60,
                                creationflags=subprocess.CREATE_NO_WINDOW)
    finally:
        if temporary: os.unlink(temporary)
    if result.returncode:
        connect.save('firebase-error', dict(stdout=result.stdout,stderr=result.stderr))
        raise connect.Error('Firebase operation failed; private response withheld')
    return json.loads(result.stdout) if operation == 'get' else None


@contextmanager
def lock():
    connect.ROOT.mkdir(parents=True, exist_ok=True)
    with (connect.ROOT / 'sync.lock').open('a+b') as handle:
        handle.seek(0)
        try: msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError: raise connect.Error('COROS sync already running') from None
        try: yield
        finally:
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)


def run(uid, days=9, apply=False):
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', uid): raise connect.Error('Invalid Firebase UID')
    if not 1 <= days <= 30: raise connect.Error('Days must be 1..30')
    with lock():
        auth = connect.get_token()
        connect.rpc(auth, 'initialize', dict(protocolVersion='2025-06-18', capabilities={},
            clientInfo=dict(name='MyDash COROS Sync', version='0.2.0')), 1)
        def call(name, args):
            return connect.rpc(auth, 'tools/call', {'name': name, 'arguments': args}, 2)
        workouts = firebase('get', f'/users/{uid}/workouts') or {}
        report = dict(status='dry_run' if not apply else 'planned', fetched=0, enriched=0, created=0, unchanged=0, review=0, no_splits=0)
        today = datetime.now(ICT).date()
        prepared, ids, target_keys = [], set(), set()
        for offset in range(days):
            day = (today-timedelta(days=offset)).strftime('%Y%m%d')
            response = call('querySportRecords', dict(startDate=day,endDate=day,sportTypeCodes=[100,101,102,103],
                minDistanceKm=None,maxDistanceKm=None,minDurationMinutes=None,maxDurationMinutes=None,
                maxAveragePace=None,locationKeyword=None,limit=200))
            for record in records(response):
                if record['id'] in ids: continue
                ids.add(record['id'])
                report['fetched'] += 1
                key, outcome = match(record, workouts)
                if key is None or key in target_keys:
                    report['review'] += 1
                    continue
                detail = normalize(record, call('queryActivityLapData', dict(labelId=record['id'],sportType=record['sportType'])))
                if detail is None:
                    report['no_splits'] += 1
                    detail = dict(schemaVersion=1, source='coros', sourceId=record['id'],
                        sportType=record['sportType'], startTimestamp=record['start'],
                        endTimestamp=record['end'], summaryTimerSeconds=record['timer'],
                        coverage=dict(laps=False, map=False, streams=False))
                target_keys.add(key)
                existing = workouts.get(key) or {}
                if existing.get('corosDetail') == detail:
                    report['unchanged'] += 1
                    continue
                value = {'corosDetail': detail}
                if outcome == 'new':
                    value.update(source='coros', sourceId=record['id'], sourceApp='COROS', date=record['date'], type='run',
                        name='COROS Run', dist=record['dist'], time=record['timer']/60, avgPace=record['timer']/60/record['dist'],
                        hr=record['hr'], startTimestamp=record['start'], createdAt=int(time.time()*1000))
                    if value['hr'] is None: del value['hr']
                prepared.append((key, value, outcome, existing))
                report['created' if outcome == 'new' else 'enriched'] += 1
        print(json.dumps(report), flush=True)
        if apply:
            # Preserve previous records encrypted for recovery; never replace an existing workout.
            if prepared:
                connect.save('before-sync-' + str(time.time_ns()), {key: old for key, _, _, old in prepared})
            for index, (key, value, outcome, old) in enumerate(prepared, 1):
                path = f'/users/{uid}/workouts/{key}'
                current = firebase('get', path) or {}
                if current != old: raise connect.Error('Workout changed during sync; retry to re-match')
                firebase('update', path, value)
                verified = firebase('get', path) or {}
                if any(verified.get(k) != v for k,v in value.items()): raise connect.Error('Firebase read-back mismatch')
                print(f'Verified activity {index}/{len(prepared)}', flush=True)
            report.update(status='success', last_sync=int(time.time()*1000), automatic=True, schema_version=1)
            firebase('update', f'/users/{uid}/sync_sources/coros', report)
            connect.save('last-sync-report', report)
            write_status(report)
            print('Firebase writes verified.', flush=True)
        return report


def write_status(report):
    connect.ROOT.mkdir(parents=True,exist_ok=True)
    timestamp = report.get('last_sync') or report.get('last_attempt') or int(time.time()*1000)
    stamp = datetime.fromtimestamp(timestamp/1000,ICT).strftime('%Y-%m-%d %H:%M:%S ICT')
    fields = ('fetched','enriched','created','unchanged','review','no_splits')
    rows = ''.join(f'<p>{field}: <strong>{escape(str(report[field]))}</strong></p>' for field in fields if field in report)
    page = '<!doctype html><meta charset="utf-8"><title>MyDash COROS Sync</title><style>body{font:18px system-ui;background:#101820;color:#e8eef2;max-width:620px;margin:60px auto;padding:24px}strong{color:#57d8af}</style>'
    page += f'<h1>MyDash COROS Sync</h1><h2>{escape(report["status"])}</h2><p>{stamp}</p>{rows}'
    page += '<p>Daily at 07:00 and 20:00 while this Windows user is signed in and the PC is online.</p>'
    if report.get('reason'): page += '<p>' + escape(report['reason']) + '</p>'
    (connect.ROOT/'status.html').write_text(page,encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--uid', required=True)
    parser.add_argument('--days', type=int, default=9)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    try: run(args.uid, args.days, args.apply)
    except Exception as exc:
        write_status({'status':'failed','last_attempt':int(time.time()*1000),
            'reason':str(exc) if isinstance(exc, connect.Error) else type(exc).__name__})
        print(str(exc) if isinstance(exc, connect.Error) else 'Sync failed; no private response logged.', flush=True)
        raise SystemExit(1)
