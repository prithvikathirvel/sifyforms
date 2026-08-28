-- Additive performance index for per-form response timelines and ordered reads.
-- This does not alter or delete any existing submission data.
CREATE INDEX `Submission_formId_createdAt_idx`
  ON `Submission`(`formId`, `createdAt`);
