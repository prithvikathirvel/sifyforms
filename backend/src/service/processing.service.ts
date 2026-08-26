import { processingResultDao } from '../dao/factory/processingResultDao.factory';
import { submissionDao } from '../dao/factory/submissionDao.factory';
import { formDao } from '../dao/factory/formDao.factory';
import { createError } from '../utils/errors';
import type { AssessmentResult } from '../services/assessment.processor';
import type { VoteTally, VotingResult } from '../services/voting.processor';

// ─── Helpers ────────────────────────────────────────────────────────────────

function maskIdentifier(id: string): string {
  if (id.length <= 6) return '***';
  return id.slice(0, 3) + '***' + id.slice(-2);
}

function computePollResultsFromData(schema: string, submissions: { data: string }[]): VotingResult {
  const parsedSchema = JSON.parse(schema);
  const allFields = parsedSchema.fields ?? [];

  const pollFields = allFields.filter(
    (f: any) => f.isPollQuestion && ['radio', 'select', 'checkbox', 'multiselect'].includes(f.type)
  );
  const targetFields = pollFields.length > 0
    ? pollFields
    : allFields.filter((f: any) => ['radio', 'select', 'checkbox', 'multiselect'].includes(f.type));

  const tallies: VoteTally[] = [];

  for (const field of targetFields) {
    const options: Array<{ label: string; value: string }> = field.options ?? [];
    const optionCounts: Record<string, number> = {};
    for (const opt of options) optionCounts[opt.value] = 0;

    let totalVotes = 0;
    for (const sub of submissions) {
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
      } catch { /* skip malformed */ }
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

  return { tallies, totalSubmissions: submissions.length, lastUpdated: new Date().toISOString() };
}

// ─── Service functions ───────────────────────────────────────────────────────

export async function getSubmissionResult(submissionId: string, formId: string, orgId: string) {
  const form = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!form) throw createError(404, 'Form not found');

  const result = await processingResultDao.findResultBySubmissionId(submissionId);
  if (!result) throw createError(404, 'Result not yet available');

  return { ...result, result: JSON.parse(result.result) };
}

export async function getSubmissionResultPublic(submissionId: string) {
  const [result, submission] = await Promise.all([
    processingResultDao.findResultBySubmissionId(submissionId),
    submissionDao.findSubmissionStatusById(submissionId),
  ]);

  if (!submission) throw createError(404, 'Submission not found');

  return {
    processingStatus: submission.processingStatus,
    result: result ? JSON.parse(result.result) : null,
  };
}

export async function getLeaderboard(formId: string, orgId: string) {
  const form = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!form) throw createError(404, 'Form not found');

  const results = await processingResultDao.findAssessmentResultsWithSubmission(formId);

  const leaderboard = results
    .map(r => {
      let parsed: AssessmentResult | null = null;
      try { parsed = JSON.parse(r.result); } catch { /* skip */ }
      return { submissionId: r.submissionId, submittedAt: r.submission.createdAt, result: parsed };
    })
    .filter((r): r is typeof r & { result: AssessmentResult } => r.result !== null)
    .sort((a, b) => (b.result.totalScore ?? 0) - (a.result.totalScore ?? 0))
    .map((r, idx) => ({ rank: idx + 1, ...r }));

  return { leaderboard, total: leaderboard.length };
}

export async function getAssessmentAnalytics(formId: string, orgId: string) {
  const form = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!form) throw createError(404, 'Form not found');

  const results = await processingResultDao.findAssessmentResults(formId);

  if (results.length === 0) {
    return { total: 0, passed: 0, failed: 0, passRate: 0, avgScore: 0, avgPercentage: 0, distribution: [] };
  }

  const parsed: AssessmentResult[] = results
    .map(r => { try { return JSON.parse(r.result) as AssessmentResult; } catch { return null; } })
    .filter((r): r is AssessmentResult => r !== null);

  const total = parsed.length;
  const passedCount = parsed.filter(r => r.passed).length;
  const avgScore = Math.round(parsed.reduce((s, r) => s + r.totalScore, 0) / total);
  const avgPercentage = Math.round(parsed.reduce((s, r) => s + r.percentage, 0) / total);

  const buckets: Record<string, number> = {};
  for (let i = 0; i <= 90; i += 10) buckets[`${i}-${i + 9}`] = 0;
  for (const r of parsed) {
    const bucket = Math.floor(r.percentage / 10) * 10;
    const key = `${bucket}-${Math.min(bucket + 9, 99)}`;
    if (buckets[key] !== undefined) buckets[key]++;
  }

  return {
    total,
    passed: passedCount,
    failed: total - passedCount,
    passRate: Math.round((passedCount / total) * 100),
    avgScore,
    avgPercentage,
    distribution: Object.entries(buckets).map(([range, count]) => ({ range, count })),
  };
}

export async function getPollResults(formId: string) {
  const form = await formDao.findFormById(formId);
  if (!form || !form.isPublished) throw createError(404, 'Form not found');

  const submissions = await submissionDao.findActiveSubmissionsByFormId(formId);
  return computePollResultsFromData(form.schema, submissions);
}

export async function getAuditLog(formId: string, orgId: string) {
  const form = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!form) throw createError(404, 'Form not found');

  const logs = await processingResultDao.findAuditLogsByFormId(formId);
  return {
    logs: logs.map(l => ({ ...l, identifier: maskIdentifier(l.identifier) })),
    total: logs.length,
  };
}
