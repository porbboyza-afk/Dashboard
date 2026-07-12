# Error And Retry Policy

Phase 0 uses no automatic retry. Request use is persisted in SQLite and limited to 30/hour, 200/day, with at least two seconds between calls. Authentication and account challenge responses stop further access; rate limiting opens a 15-minute circuit.

