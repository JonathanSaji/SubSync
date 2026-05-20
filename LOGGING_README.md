# Event Logging System Documentation

## Overview
SubSync now includes a comprehensive event logging system that tracks all button clicks and corresponding database operations. This enables debugging of the button→API→DB operation flow.

## Features

### Event Types
- **BUTTON**: User interaction events (button clicks, form submissions)
  - Create Account Clicked
  - Login Clicked
  - Logout Clicked
  - Save Subscription Clicked
  - Delete Subscription Clicked
  - Create Trial Clicked

- **DB**: Database operation results
  - INSERT accounts
  - SELECT accounts
  - INSERT subscriptions (including trials)
  - DELETE subscriptions
  - All DB operations include status (success/error) and relevant details

### Log Format
Each log entry contains:
```
TIMESTAMP | [EVENT_TYPE] EVENT_NAME | JSON_DETAILS
```

Example:
```
2026-05-15T14:22:34.443Z | [BUTTON] Create Account Clicked | {"username":"testuser","email":"test@example.com"}
2026-05-15T14:22:34.696Z | [DB] INSERT accounts | {"username":"testuser","email":"test@example.com","status":"success","userId":"7"}
```

## Accessing Logs

### Via API Endpoint
```bash
curl http://localhost:3000/api/logs
```

Returns JSON:
```json
{
  "success": true,
  "logCount": 4,
  "logs": [
    "timestamp | [EVENT_TYPE] EVENT_NAME | details",
    ...
  ]
}
```

### Log File
The raw log file is stored in: `logs/events.log` (created on first server start)

## Implementation Details

### Frontend (script.js)
The `logEvent()` function is a global async function that:
- Takes eventType, eventName, and optional details object
- Makes a POST request to `/api/log-event`
- Logs to browser console for debugging
- Non-blocking (doesn't interrupt user actions if API fails)

Called from:
- Auth handlers (signup, login, logout)
- Subscription handlers (save, delete, create trial)
- Form validation failures

### Backend (server.js)
- `logEvent(eventType, eventName, details)`: Writes log entries to events.log file
- `POST /api/log-event`: Receives frontend log data
- `GET /api/logs`: Returns last 100 log lines as JSON

### Log Storage
- File: `logs/events.log` (append-only)
- Created on server startup in `logs/` directory
- Each line is one JSON-formatted entry
- No automatic rotation (grows indefinitely - rotation recommended for production)

## Example Event Flow

### Account Creation Flow
```
1. User fills signup form and clicks "Create Account"
2. Frontend logs: [BUTTON] Create Account Clicked | {username, email}
3. Frontend calls POST /api/signup
4. Server validates and creates account
5. Frontend logs: [DB] INSERT accounts | {username, email, status, userId}
```

### Subscription Save Flow
```
1. User completes form and clicks "Save Subscription"
2. Frontend logs: [BUTTON] Save Subscription Clicked | {name, amount, category, billingCycle}
3. Frontend calls POST /api/subscriptions
4. Server validates and inserts into DB
5. Frontend logs: [DB] INSERT subscriptions | {subId, name, status}
```

## Debugging with Logs

To debug a button→DB operation issue:
1. Call `GET /api/logs` to retrieve last 100 events
2. Find the BUTTON event with timestamp
3. Look for corresponding DB event with matching operation
4. If DB event is missing: API call failed or wasn't made
5. If DB event shows error: Database constraint or query issue

Example analysis:
```
2026-05-15T14:22:34.443Z | [BUTTON] Create Account Clicked
2026-05-15T14:22:34.696Z | [DB] INSERT accounts | {...status:"success"...}
→ Operation succeeded, 253ms latency
```

vs.

```
2026-05-15T14:22:34.443Z | [BUTTON] Create Account Clicked
2026-05-15T14:22:35.100Z | [DB] INSERT accounts | {...status:"error"...}
→ Operation failed after 657ms
```

## Future Enhancements

1. **Log Rotation**: Implement daily or size-based rotation to prevent unbounded growth
2. **Persistence**: Store logs in database for long-term analysis
3. **Filtering**: Add filters for event type, date range, user ID
4. **Analytics**: Track operation latency, error rates, peak usage times
5. **Admin Dashboard**: Web UI to browse and search logs

## Notes

- Logs are human-readable but not real-time (frontend makes async POST requests)
- Sensitive data (passwords) is redacted in logs via `redactSensitiveBody()`
- Log entries include user context (userId when available) for multi-user debugging
- Console logs appear in browser DevTools for real-time debugging during development
