import prisma from '../utils/prisma';

interface VotingSettings {
  duplicatePrevention?: 'none' | 'ip' | 'email';
  showResultsAfterVoting?: boolean;
  showResultsPublic?: boolean;
}

export interface VoteTally {
  fieldId: string;
  label: string;
  options: Array<{
    value: string;
    label: string;
    count: number;
    percentage: number;
  }>;
  totalVotes: number;
}

export interface VotingResult {
  tallies: VoteTally[];
  totalSubmissions: number;
  lastUpdated: string;
}

// Called before submission is stored — returns error string if duplicate, null if ok
export async function checkVotingDuplicate(
  formId: string,
  identifier: string
): Promise<string | null> {
  const existing = await prisma.auditLog.findFirst({
    where: { formId, identifier },
  });
  if (existing) return 'You have already voted on this form.';
  return null;
}

// Called after submission is stored — writes audit log + recomputes tallies
export async function processVote(submissionId: string, identifier: string): Promise<void> {
  try {
    await prisma.submission.update({
      where: { id: submissionId },
      data: { processingStatus: 'processing' },
    });

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { form: true },
    });
    if (!submission) throw new Error(`Submission ${submissionId} not found`);

    // Write audit log entry
    await prisma.auditLog.create({
      data: {
        formId: submission.formId,
        submissionId,
        identifier,
      },
    });

    // Recompute aggregate tallies from all submissions for this form
    const allSubmissions = await prisma.submission.findMany({
      where: { formId: submission.formId, processingStatus: { not: 'failed' } },
      select: { data: true },
    });

    const schema = JSON.parse(submission.form.schema);
    const pollFields = (schema.fields ?? []).filter(
      (f: any) => f.isPollQuestion && (f.type === 'radio' || f.type === 'select' || f.type === 'checkbox' || f.type === 'multiselect')
    );

    // Also include any radio/select/checkbox fields if no explicit isPollQuestion flags set
    const targetFields = pollFields.length > 0
      ? pollFields
      : (schema.fields ?? []).filter(
          (f: any) => f.type === 'radio' || f.type === 'select' || f.type === 'checkbox' || f.type === 'multiselect'
        );

    const tallies: VoteTally[] = [];

    for (const field of targetFields) {
      const optionCounts: Record<string, number> = {};
      const options: Array<{ label: string; value: string }> = field.options ?? [];

      // Initialise all options to 0
      for (const opt of options) {
        optionCounts[opt.value] = 0;
      }

      let totalVotes = 0;

      for (const sub of allSubmissions) {
        try {
          const data = JSON.parse(sub.data);
          const answer = data[field.id];
          if (answer === undefined || answer === null || answer === '') continue;

          const answers = Array.isArray(answer) ? answer : [answer];
          for (const a of answers) {
            const key = String(a);
            if (optionCounts[key] !== undefined) {
              optionCounts[key]++;
            } else {
              optionCounts[key] = 1;
            }
          }
          totalVotes++;
        } catch {
          // skip malformed submission
        }
      }

      const tally: VoteTally = {
        fieldId: field.id,
        label: field.label,
        totalVotes,
        options: options.map(opt => ({
          value: opt.value,
          label: opt.label,
          count: optionCounts[opt.value] ?? 0,
          percentage: totalVotes > 0 ? Math.round(((optionCounts[opt.value] ?? 0) / totalVotes) * 100) : 0,
        })),
      };
      tallies.push(tally);
    }

    const result: VotingResult = {
      tallies,
      totalSubmissions: allSubmissions.length,
      lastUpdated: new Date().toISOString(),
    };

    // Store per-submission result (lightweight — just this vote's contribution)
    await prisma.processingResult.upsert({
      where: { submissionId },
      create: {
        submissionId,
        formId: submission.formId,
        type: 'voting',
        result: JSON.stringify({ identifier, votedAt: new Date().toISOString() }),
      },
      update: {
        result: JSON.stringify({ identifier, votedAt: new Date().toISOString() }),
        processedAt: new Date(),
      },
    });

    // Store the form-level aggregate result under a sentinel submissionId key in a separate row
    // We use formId-keyed lookup via a raw upsert on the formId index
    // Strategy: store aggregate as a special processingResult with submissionId = "aggregate:{formId}"
    // This requires a workaround since submissionId is a FK — instead we cache on form settings JSON.
    // Simpler: just recompute on GET /poll-results from scratch. No extra row needed.
    // Mark submission done.
    await prisma.submission.update({
      where: { id: submissionId },
      data: { processingStatus: 'done' },
    });
  } catch (err) {
    console.error('[VotingProcessor] Error processing vote', submissionId, err);
    await prisma.submission.update({
      where: { id: submissionId },
      data: { processingStatus: 'failed' },
    }).catch(() => {});
  }
}

// Compute live vote tallies for a form (called by GET /poll-results)
export async function computePollResults(formId: string): Promise<VotingResult> {
  const form = await prisma.form.findUnique({ where: { id: formId } });
  if (!form) throw new Error('Form not found');

  const allSubmissions = await prisma.submission.findMany({
    where: { formId, processingStatus: { not: 'failed' } },
    select: { data: true },
  });

  const schema = JSON.parse(form.schema);
  const pollFields = (schema.fields ?? []).filter(
    (f: any) => f.isPollQuestion && (f.type === 'radio' || f.type === 'select' || f.type === 'checkbox' || f.type === 'multiselect')
  );
  const targetFields = pollFields.length > 0
    ? pollFields
    : (schema.fields ?? []).filter(
        (f: any) => f.type === 'radio' || f.type === 'select' || f.type === 'checkbox' || f.type === 'multiselect'
      );

  const tallies: VoteTally[] = [];

  for (const field of targetFields) {
    const optionCounts: Record<string, number> = {};
    const options: Array<{ label: string; value: string }> = field.options ?? [];

    for (const opt of options) {
      optionCounts[opt.value] = 0;
    }

    let totalVotes = 0;

    for (const sub of allSubmissions) {
      try {
        const data = JSON.parse(sub.data);
        const answer = data[field.id];
        if (answer === undefined || answer === null || answer === '') continue;
        const answers = Array.isArray(answer) ? answer : [answer];
        for (const a of answers) {
          const key = String(a);
          optionCounts[key] = (optionCounts[key] ?? 0) + 1;
        }
        totalVotes++;
      } catch {
        // skip
      }
    }

    tallies.push({
      fieldId: field.id,
      label: field.label,
      totalVotes,
      options: options.map(opt => ({
        value: opt.value,
        label: opt.label,
        count: optionCounts[opt.value] ?? 0,
        percentage: totalVotes > 0 ? Math.round(((optionCounts[opt.value] ?? 0) / totalVotes) * 100) : 0,
      })),
    });
  }

  return {
    tallies,
    totalSubmissions: allSubmissions.length,
    lastUpdated: new Date().toISOString(),
  };
}
