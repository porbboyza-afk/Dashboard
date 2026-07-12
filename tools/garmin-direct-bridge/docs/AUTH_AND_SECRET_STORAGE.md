# Authentication And Secret Storage

Login is interactive. Password and MFA values are never written to disk or logs. The refreshed Garmin session serialization is encrypted using Windows DPAPI Current User scope. There is deliberately no plaintext fallback.

