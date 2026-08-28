# Results analytics database change

_Date: 28 August 2026_

## Is a database migration required?

**No database change is required for the new insights to function.** The aggregate API calculates totals, answer rates, distributions, numeric statistics, and the 14-day response trend from existing `Submission.data` and `Submission.createdAt` values.

One optional, additive index is included to keep per-form timeline and ordered-submission reads efficient as a form grows:

```prisma
@@index([formId, createdAt])
```

This index:

- Does not add, remove, or rewrite application data
- Does not change a column type
- Does not introduce a new table
- Can be added while retaining all existing submissions
- Uses additional disk space while improving reads filtered by form and ordered/grouped by date

## SQL to apply manually

Take the normal database backup required by your deployment policy, confirm the index does not already exist, and then run:

```sql
CREATE INDEX `Submission_formId_createdAt_idx`
  ON `Submission` (`formId`, `createdAt`);
```

On a very large `Submission` table, schedule index creation during a lower-traffic period. Depending on the MySQL version and storage engine, building an index can consume temporary disk space and briefly hold a metadata lock even though it does not delete or rewrite submission values.

## Confirm whether it already exists

```sql
SELECT
  INDEX_NAME,
  COLUMN_NAME,
  SEQ_IN_INDEX
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Submission'
  AND INDEX_NAME = 'Submission_formId_createdAt_idx'
ORDER BY SEQ_IN_INDEX;
```

Expected result:

| INDEX_NAME | COLUMN_NAME | SEQ_IN_INDEX |
|---|---|---:|
| Submission_formId_createdAt_idx | formId | 1 |
| Submission_formId_createdAt_idx | createdAt | 2 |

## Important when applying SQL manually

The repository also contains the matching Prisma migration:

```text
backend/prisma/migrations/20260828093000_submission_analytics_index/migration.sql
```

If you execute the SQL manually, mark that migration as applied before a future `prisma migrate deploy` attempts to create the same index:

```bash
cd backend
npx prisma migrate resolve --applied 20260828093000_submission_analytics_index
```

Do this only against the same database where the SQL was already executed.

Alternatively, let Prisma apply the migration normally:

```bash
cd backend
npx prisma migrate deploy
```

`migrate deploy` executes the included `CREATE INDEX`; it does not reset or seed the database. Do **not** use `prisma migrate reset` on an environment containing data.

## Rollback, if required

The index can be removed without deleting submissions:

```sql
DROP INDEX `Submission_formId_createdAt_idx` ON `Submission`;
```

Removing it only removes the performance optimization. The Results page and API continue to work because the analytics require no new data columns.
