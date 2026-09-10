import json
import unittest
from contextlib import nullcontext
from unittest.mock import patch
import sync


def envelope(value): return {'content': [{'type':'text','text':json.dumps(value)}], 'isError':False}


class SyncTests(unittest.TestCase):
    def setUp(self):
        self.record = dict(id='123',sportType=100,date='2026-09-08',start=10000,end=10600,dist=2,timer=597,hr=140)
        self.lap = dict(lapIndex=1,distance=100000,time=300,avgPace=300,avgHr=140,avgCadence=180)

    def test_empty_day_is_not_a_failure_but_unknown_text_is(self):
        self.assertEqual(sync.records(envelope('No sport records found from 2026-09-09 to 2026-09-09.')), [])
        with self.assertRaises(sync.connect.Error): sync.records(envelope('Service unavailable'))

    def test_parse_units_and_exact_identity(self):
        text='Sport Records — 2026-09-08 to 2026-09-08 (1 records)\n===\n\n1. Outdoor Run — 2026-09-08\n   Time Window: startTimestamp=10000 | endTimestamp=10600\n   Duration: 9:57 | Distance: 2.00 km\n   Avg HR: 140 bpm\n   LabelId: 123 | SportType: 100'
        self.assertEqual(sync.records(envelope(text)), [self.record])
        self.assertEqual(sync.records(envelope(text.replace('2.00 km', '750 m')))[0]['dist'], .75)
        with self.assertRaises(sync.connect.Error): sync.records(envelope(text.replace('(1 records)', '(2 records)')))

    def test_normalize_selects_only_distance_splits(self):
        payload = dict(labelId='123',sportType=100,lapGroups=[
            dict(type=10,lapDistance=100000,laps=[self.lap,dict(self.lap,lapIndex=2)]),
            dict(type=-1,laps=[dict(self.lap,distance=200000,time=597)])])
        detail = sync.normalize(self.record, envelope(payload))
        self.assertEqual(len(detail['laps']), 2)
        self.assertEqual(sum(l['distanceKm'] for l in detail['laps']), 2)
        self.assertEqual(detail['laps'][0]['pace'], 5)
        self.assertEqual(detail['summaryTimerSeconds'], 597)
        self.assertEqual(detail['elapsedSeconds'], 600)
        payload['lapGroups'][0]['laps'][0]['distance'] = 1000
        with self.assertRaises(sync.connect.Error): sync.normalize(self.record,envelope(payload))

    def test_precise_timestamp_beats_duplicate_without_time(self):
        w=dict(date='2026-09-08',type='run',dist=2,time=10)
        key, outcome = sync.match(self.record, {'a':w, 'b':dict(w,startTimestamp=10000)})
        self.assertEqual((key,outcome),('b','matched'))

    def test_ambiguous_summary_does_not_insert(self):
        w=dict(date='2026-09-08',type='run',dist=2,time=10)
        self.assertEqual(sync.match(self.record, {'a':w,'b':w}), (None,'ambiguous'))

    def test_near_but_uncertain_match_does_not_insert(self):
        w=dict(date='2026-09-08',type='run',dist=2.15,time=10)
        self.assertEqual(sync.match(self.record, {'a':w}), (None,'review'))

    def test_linked_record_reuses_original_key(self):
        self.assertEqual(sync.match(self.record, {'original': {'corosDetail': {'sourceId':'123'}}}), ('original','matched'))

    def test_absent_record_has_deterministic_key(self):
        self.assertEqual(sync.match(self.record, {}), ('coros_123','new'))

    def test_missing_hr_not_saved_as_zero(self):
        lap=dict(self.lap, distance=200000,time=600,avgHr=0,avgCadence=0)
        detail=sync.normalize(self.record,envelope(dict(labelId='123',sportType=100,lapGroups=[dict(type=10,lapDistance=100000,laps=[lap])])))
        self.assertNotIn('averageHr',detail['laps'][0])
        self.assertNotIn('cadence',detail['laps'][0])

    def test_verified_enrichment_preserves_manual_fields_and_second_run_noop(self):
        detail = {'source':'coros','sourceId':'123','laps':[{'distanceKm':2,'durationMin':10}]}
        database = {'old-key':dict(date='2026-09-08',type='run',dist=2,time=10,note='Keep my note',rpe=7)}
        writes=[]
        def firebase(operation,path,value=None):
            if operation=='get':
                if path.endswith('/workouts'): return json.loads(json.dumps(database))
                return json.loads(json.dumps(database.get(path.split('/')[-1])))
            writes.append((path,value))
            if '/workouts/' in path: database[path.split('/')[-1]].update(value)
        with patch.object(sync,'lock',return_value=nullcontext()),patch.object(sync.connect,'get_token',return_value={}),patch.object(sync.connect,'rpc',return_value={}),patch.object(sync.connect,'save'),patch.object(sync,'write_status'),patch.object(sync,'firebase',side_effect=firebase),patch.object(sync,'records',return_value=[self.record]),patch.object(sync,'normalize',return_value=detail):
            first=sync.run('owner',days=1,apply=True)
            second=sync.run('owner',days=1,apply=True)
        self.assertEqual(database['old-key']['note'],'Keep my note')
        self.assertEqual(database['old-key']['rpe'],7)
        self.assertEqual(first['enriched'],1)
        self.assertEqual(second['unchanged'],1)
        activity_writes=[v for p,v in writes if '/workouts/' in p]
        self.assertEqual(activity_writes,[{'corosDetail':detail}])

    def test_activity_without_splits_is_created(self):
        with patch.object(sync,'lock',return_value=nullcontext()),patch.object(sync.connect,'get_token',return_value={}),patch.object(sync.connect,'rpc',return_value={}),patch.object(sync,'firebase',return_value={}),patch.object(sync,'records',return_value=[self.record]),patch.object(sync,'normalize',return_value=None):
            report=sync.run('owner',days=1,apply=False)
        self.assertEqual(report['created'],1)
        self.assertEqual(report['no_splits'],1)

    def test_concurrent_workout_change_aborts_before_write(self):
        old=dict(date='2026-09-08',type='run',dist=2,time=10)
        with patch.object(sync,'lock',return_value=nullcontext()),patch.object(sync.connect,'get_token',return_value={}),patch.object(sync.connect,'rpc',return_value={}),patch.object(sync.connect,'save'),patch.object(sync,'firebase',side_effect=[{'key':old},dict(old,note='Edited concurrently')]) as fb,patch.object(sync,'records',return_value=[self.record]),patch.object(sync,'normalize',return_value={'sourceId':'123'}):
            with self.assertRaises(sync.connect.Error): sync.run('owner',days=1,apply=True)
            self.assertTrue(all(call.args[0]=='get' for call in fb.call_args_list))


if __name__ == '__main__': unittest.main()
