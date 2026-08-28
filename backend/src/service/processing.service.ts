import { processingResultDao } from '../dao/factory/processingResultDao.factory';
import { submissionDao } from '../dao/factory/submissionDao.factory';
import { formDao } from '../dao/factory/formDao.factory';
import { createError } from '../utils/errors';
import { assertResponseLevel } from './formAccess.service';
import { MIN_RESPONSES_FOR_BREAKDOWN } from './responseView.service';
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

export async function getSubmissionResult(submissionId: string, formId: string, orgId: string, userId: string) {
  const form = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!form) throw createError(404, 'Form not found');
  await assertResponseLevel(userId, orgId, formId, 'REDACTED');

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

  const form = await formDao.findFormById(submission.formId);
  if (!form || !form.isPublished) throw createError(404, 'Form not found');

  const settings = JSON.parse(form.settings);
  if (
    settings.formType !== 'assessment' ||
    settings.assessment?.showScoreAfterSubmit !== true
  ) {
    throw createError(403, 'Public score results are disabled for this form');
  }

  let publicResult: Record<string, unknown> | null = result
    ? JSON.parse(result.result) as Record<string, unknown>
    : null;

  // A per-question correctness oracle can reveal the answer key even without
  // the literal correctAnswer value, so hide the whole review unless enabled.
  if (publicResult && settings.assessment?.showCorrectAnswers !== true) {
    publicResult = { ...publicResult };
    delete publicResult.fieldResults;
  }

  return {
    processingStatus: submission.processingStatus,
    result: publicResult,
  };
}

export async function getLeaderboard(formId: string, orgId: string, userId: string) {
  const form = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!form) throw createError(404, 'Form not found');
  await assertResponseLevel(userId, orgId, formId, 'REDACTED');

  const results = await processingResultDao.findAssessmentResultsWithSubmission(formId);

  const sorted = results
    .map(r => {
      let parsed: AssessmentResult | null = null;
      try { parsed = JSON.parse(r.result); } catch { /* skip */ }
      return { submissionId: r.submissionId, submittedAt: r.submission.createdAt, result: parsed };
    })
    .filter((r): r is typeof r & { result: AssessmentResult } => r.result !== null)
    .sort((a, b) => {
      const scoreDifference = (b.result.totalScore ?? 0) - (a.result.totalScore ?? 0);
      return scoreDifference || a.submittedAt.getTime() - b.submittedAt.getTime();
    });

  let previousScore: number | null = null;
  let previousRank = 0;
  const leaderboard = sorted.map((entry, index) => {
    const score = entry.result.totalScore ?? 0;
    const rank = previousScore === score ? previousRank : index + 1;
    previousScore = score;
    previousRank = rank;
    return { rank, ...entry };
  });

  const total = leaderboard.length;
  const passed = leaderboard.filter(entry => entry.result.passed).length;
  return {
    leaderboard,
    total,
    summary: {
      topScore: total > 0 ? leaderboard[0].result.totalScore : 0,
      topPercentage: total > 0 ? leaderboard[0].result.percentage : 0,
      averagePercentage: total > 0
        ? Math.round(leaderboard.reduce((sum, entry) => sum + entry.result.percentage, 0) / total)
        : 0,
      passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
    },
  };
}

export async function getAssessmentAnalytics(formId: string, orgId: string, userId: string) {
  const form = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!form) throw createError(404, 'Form not found');
  const access = await assertResponseLevel(userId, orgId, formId, 'AGGREGATE');
  const settings = JSON.parse(form.settings) as { assessment?: { passThreshold?: number } };
  const passThreshold = settings.assessment?.passThreshold ?? 60;

  const records = await processingResultDao.findAssessmentResultsWithSubmission(formId);
  const entries = records
    .map(record => {
      try {
        return {
          result: JSON.parse(record.result) as AssessmentResult,
          submittedAt: record.submission.createdAt,
        };
      } catch {
        return null;
      }
    })
    .filter((entry): entry is { result: AssessmentResult; submittedAt: Date } => entry !== null);

  const total = entries.length;
  const suppressed = access.level === 'AGGREGATE' && total > 0 && total < MIN_RESPONSES_FOR_BREAKDOWN;
  const empty = {
    total,
    passed: 0,
    failed: 0,
    passRate: 0,
    passThreshold,
    avgScore: 0,
    averageMaxScore: 0,
    avgPercentage: 0,
    medianPercentage: 0,
    highestPercentage: 0,
    lowestPercentage: 0,
    scoreSpread: 0,
    distribution: [] as Array<{ range: string; count: number; percentage: number }>,
    trend: [] as Array<{ date: string; attempts: number; averagePercentage: number; passRate: number }>,
    recent: {
      attemptsLast7Days: 0,
      attemptsPrevious7Days: 0,
      attemptChangePercent: 0 as number | null,
      averageLast7Days: 0,
      averagePrevious7Days: 0,
      scoreChange: 0,
    },
    questionPerformance: [] as Array<{
      fieldId: string;
      label: string;
      attempts: number;
      correct: number;
      incorrect: number;
      accuracy: number;
      averagePoints: number;
      maxPoints: number;
    }>,
    sectionPerformance: [] as Array<{
      key: string;
      label: string;
      score: number;
      maxScore: number;
      percentage: number;
    }>,
    suppressed,
    minimumForBreakdown: MIN_RESPONSES_FOR_BREAKDOWN,
  };

  if (total === 0 || suppressed) return empty;

  const percentages = entries.map(entry => entry.result.percentage).sort((a, b) => a - b);
  const scores = entries.map(entry => entry.result.totalScore);
  const maxScores = entries.map(entry => entry.result.maxScore);
  const passed = entries.filter(entry => entry.result.passed).length;
  const avgPercentage = Math.round(percentages.reduce((sum, value) => sum + value, 0) / total);
  const middle = Math.floor(total / 2);
  const medianPercentage = total % 2
    ? percentages[middle]
    : Math.round(((percentages[middle - 1] ?? 0) + (percentages[middle] ?? 0)) / 2);
  const variance = percentages.reduce((sum, value) => sum + ((value - avgPercentage) ** 2), 0) / total;

  const bucketLabels = [
    '0-9', '10-19', '20-29', '30-39', '40-49',
    '50-59', '60-69', '70-79', '80-89', '90-99', '100',
  ];
  const buckets = new Map(bucketLabels.map(label => [label, 0]));
  for (const percentage of percentages) {
    const label = percentage >= 100
      ? '100'
      : `${Math.floor(Math.max(percentage, 0) / 10) * 10}-${Math.floor(Math.max(percentage, 0) / 10) * 10 + 9}`;
    buckets.set(label, (buckets.get(label) ?? 0) + 1);
  }
  const distribution = bucketLabels.map(range => {
    const count = buckets.get(range) ?? 0;
    return { range, count, percentage: Math.round((count / total) * 100) };
  });

  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 13);
  const dateKey = (date: Date) => date.toISOString().slice(0, 10);
  const byDate = new Map<string, AssessmentResult[]>();
  for (const entry of entries) {
    if (entry.submittedAt.getTime() < start.getTime() || entry.submittedAt.getTime() >= end.getTime() + 86_400_000) continue;
    const key = dateKey(entry.submittedAt);
    const values = byDate.get(key) ?? [];
    values.push(entry.result);
    byDate.set(key, values);
  }
  const trend = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const values = byDate.get(dateKey(date)) ?? [];
    const dayPassed = values.filter(result => result.passed).length;
    return {
      date: dateKey(date),
      attempts: values.length,
      averagePercentage: values.length
        ? Math.round(values.reduce((sum, result) => sum + result.percentage, 0) / values.length)
        : 0,
      passRate: values.length ? Math.round((dayPassed / values.length) * 100) : 0,
    };
  });

  const previousWeek = trend.slice(0, 7);
  const currentWeek = trend.slice(7);
  const attemptsPrevious7Days = previousWeek.reduce((sum, day) => sum + day.attempts, 0);
  const attemptsLast7Days = currentWeek.reduce((sum, day) => sum + day.attempts, 0);
  const previousScores = previousWeek.flatMap(day => byDate.get(day.date) ?? []).map(result => result.percentage);
  const currentScores = currentWeek.flatMap(day => byDate.get(day.date) ?? []).map(result => result.percentage);
  const averagePrevious7Days = previousScores.length
    ? Math.round(previousScores.reduce((sum, value) => sum + value, 0) / previousScores.length)
    : 0;
  const averageLast7Days = currentScores.length
    ? Math.round(currentScores.reduce((sum, value) => sum + value, 0) / currentScores.length)
    : 0;
  const attemptChangePercent = attemptsPrevious7Days > 0
    ? Math.round(((attemptsLast7Days - attemptsPrevious7Days) / attemptsPrevious7Days) * 100)
    : attemptsLast7Days === 0 ? 0 : null;

  const questions = new Map<string, {
    fieldId: string;
    label: string;
    attempts: number;
    correct: number;
    score: number;
    maxScore: number;
  }>();
  const sections = new Map<string, { key: string; label: string; score: number; maxScore: number }>();
  for (const entry of entries) {
    for (const field of entry.result.fieldResults ?? []) {
      const current = questions.get(field.fieldId) ?? {
        fieldId: field.fieldId,
        label: field.label,
        attempts: 0,
        correct: 0,
        score: 0,
        maxScore: 0,
      };
      current.attempts += 1;
      current.correct += field.isCorrect ? 1 : 0;
      current.score += field.score;
      current.maxScore += field.maxScore;
      questions.set(field.fieldId, current);
    }
    for (const [key, section] of Object.entries(entry.result.sections ?? {})) {
      const current = sections.get(key) ?? { key, label: section.label, score: 0, maxScore: 0 };
      current.score += section.score;
      current.maxScore += section.maxScore;
      sections.set(key, current);
    }
  }

  const questionPerformance = [...questions.values()]
    .map(question => ({
      fieldId: question.fieldId,
      label: question.label,
      attempts: question.attempts,
      correct: question.correct,
      incorrect: question.attempts - question.correct,
      accuracy: question.attempts ? Math.round((question.correct / question.attempts) * 100) : 0,
      averagePoints: question.attempts ? Number((question.score / question.attempts).toFixed(2)) : 0,
      maxPoints: question.attempts ? Number((question.maxScore / question.attempts).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.accuracy - a.accuracy || a.label.localeCompare(b.label));
  const sectionPerformance = [...sections.values()]
    .map(section => ({
      ...section,
      percentage: section.maxScore > 0 ? Math.round((section.score / section.maxScore) * 100) : 0,
    }))
    .sort((a, b) => b.percentage - a.percentage);

  return {
    ...empty,
    passed,
    failed: total - passed,
    passRate: Math.round((passed / total) * 100),
    avgScore: Number((scores.reduce((sum, value) => sum + value, 0) / total).toFixed(2)),
    averageMaxScore: Number((maxScores.reduce((sum, value) => sum + value, 0) / total).toFixed(2)),
    avgPercentage,
    medianPercentage,
    highestPercentage: percentages[percentages.length - 1] ?? 0,
    lowestPercentage: percentages[0] ?? 0,
    scoreSpread: Number(Math.sqrt(variance).toFixed(2)),
    distribution,
    trend,
    recent: {
      attemptsLast7Days,
      attemptsPrevious7Days,
      attemptChangePercent,
      averageLast7Days,
      averagePrevious7Days,
      scoreChange: averageLast7Days - averagePrevious7Days,
    },
    questionPerformance,
    sectionPerformance,
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
