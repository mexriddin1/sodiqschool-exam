# API reference

All endpoints return:

```
{ "success": true, "data": <T> }
```

or:

```
{ "success": false, "error": { "code": "...", "message": "...", "fields": {} } }
```

All admin endpoints require the `sodiq_admin` cookie set by `POST
/api/admin/auth/login`. All public-result endpoints accept either the
`sodiq_result` cookie or `Authorization: Bearer <token>` header.

## Admin auth

| Method | Path                       | Body                  | Response                                  |
| ------ | -------------------------- | --------------------- | ----------------------------------------- |
| POST   | `/api/admin/auth/login`    | `{email, password}`   | `{id, email, fullName, role}` + cookie    |
| POST   | `/api/admin/auth/logout`   | —                     | `{loggedOut: true}`                       |
| GET    | `/api/admin/auth/me`       | —                     | `{id, email, fullName, role}`             |

## Students

| Method | Path                          | Notes                                  |
| ------ | ----------------------------- | -------------------------------------- |
| GET    | `/api/admin/students?q=&grade=` | List, search, filter by grade        |
| POST   | `/api/admin/students`         | Create                                 |
| GET    | `/api/admin/students/:id`     | Detail + nested results                |
| PATCH  | `/api/admin/students/:id`     | Update (partial)                       |
| DELETE | `/api/admin/students/:id`     | Delete (restricted if results exist)   |

## Exams

| Method | Path                       | Notes                                              |
| ------ | -------------------------- | -------------------------------------------------- |
| GET    | `/api/admin/exams?grade=`  | List                                               |
| POST   | `/api/admin/exams`         | Create. `admissionThresholds` is required          |
| GET    | `/api/admin/exams/:id`     | Detail with result count                           |
| PATCH  | `/api/admin/exams/:id`     | Update                                             |
| DELETE | `/api/admin/exams/:id`     | Delete                                             |

## Results (admin)

| Method | Path                                       | Notes                                                  |
| ------ | ------------------------------------------ | ------------------------------------------------------ |
| GET    | `/api/admin/results?examId=&status=&q=`    | List with filters                                      |
| POST   | `/api/admin/results`                       | Create — returns `{result, credentials}` once          |
| GET    | `/api/admin/results/:id`                   | Detail with subjects                                   |
| PATCH  | `/api/admin/results/:id`                   | Update; recalculates                                   |
| GET    | `/api/admin/results/:id/preview`           | Same data shape the student would see                  |
| POST   | `/api/admin/results/:id/publish`           | Freezes `calculatedSnapshot`, computes cohort rank     |
| POST   | `/api/admin/results/:id/unpublish`         | Returns to DRAFT                                       |
| POST   | `/api/admin/results/:id/archive`           | Hide from public                                       |
| POST   | `/api/admin/results/:id/reset-password`    | Returns new `{publicCode, password}` once              |
| DELETE | `/api/admin/results/:id`                   | Hard delete (cascades subjects). Recomputes cohort if published |

### Create body shape

```jsonc
{
  "studentId": "<uuid>",
  "examId": "<uuid>",
  "manualContent": {
    "parent": "string",
    "committee": "string",
    "outlook": "string",
    "bloomFallback": { "Tahlil": 86, ... },
    "skillRadar": [{ "name": "...", "value": 82 }],
    "reasoningTypes": [{ "name": "Deduktiv", "gloss": "...", "value": 85 }],
    "cohort": { "rank": null, "total": null, "percentile": null }
  },
  "subjects": [
    {
      "subject": "MATH" | "ENGLISH" | "CRITICAL_THINKING",
      "questions": [/* Question[] — see @sodiq/compute types */],
      "realData": { "percentile": null, "cohortAverage": null, "avgTimeSec": null },
      "manualNotes": { "strength": "...", "growthLabel": "..." }
    }
  ]
}
```

## Result login (public)

| Method | Path                          | Body              | Notes                                                  |
| ------ | ----------------------------- | ----------------- | ------------------------------------------------------ |
| POST   | `/api/result/auth/login`      | `{code, password}` | 6/15-min IP rate-limit; generic error on invalid creds |
| POST   | `/api/result/auth/logout`     | —                 | Clears cookie                                          |
| GET    | `/api/result/auth/me`         | —                 | `{resultId, publicCode}` from current session          |
| GET    | `/api/result/me`              | —                 | Full result payload scoped to the session              |

Login returns `{resultId, token}`. The token is also delivered as `sodiq_result`
httpOnly cookie. Same-origin clients can use the cookie; cross-origin clients
(e.g. the Astro server) should keep the token and forward it as
`Authorization: Bearer`.
