# PashuMittr v31

## Fix: stale environment-sensor connection
- Fixed repeated `409 SENSOR_NOT_CONNECTED` refresh requests after a backend restart.
- Frontend now resets stale connected state when backend reports the demo sensor is no longer connected.
- Automatic 10-second refresh stops once the stale connection is cleared.
- Farmer sees a single actionable message to reconnect the storage sensor.
