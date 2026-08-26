import prisma from '../utils/prisma';

interface AssessmentField {
  id: string;
  type: string;
  label: string;
  correctAnswer?: string | string[];
  points?: number;
  section?: string;
  options?: Array<{ label: string; value: string }>;
}

interface AssessmentSettings {
  passThreshold?: number;        // percentage 0–100, default 60
  showScoreAfterSubmit?: boolean;
  showCorrectAnswers?: boolean;
}

export interface AssessmentResult {
  totalScore: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  rank?: number;
  totalParticipants?: number;
  sections: Record<string, { score: number; maxScore: number; label: string }>;
  fieldResults: Array<{
    fieldId: string;
    label: string;
    submittedAnswer: unknown;
    correctAnswer: unknown;
    isCorrect: boolean;
    score: number;
    maxScore: number;
  }>;
}

function normalizeAnswer(val: unknown): string {
  if (Array.isArray(val)) return val.map(v => String(v).trim().toLowerCase()).sort().join('|');
  return String(val ?? '').trim().toLowerCase();
}

function isCorrect(submitted: unknown, correct: string | string[] | undefined): boolean {
  if (correct === undefined || correct === null || correct === '') return false;
  const submittedNorm = normalizeAnswer(submitted);
  const correctNorm = normalizeAnswer(correct);
  return submittedNorm === correctNorm;
}

export async function processAssessment(submissionId: string): Promise<void> {
  try {
    // Mark as processing
    await prisma.submission.update({
      where: { id: submissionId },
      data: { processingStatus: 'processing' },
    });

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { form: true },
    });

    if (!submission) throw new Error(`Submission ${submissionId} not found`);

    const schema = JSON.parse(submission.form.schema);
    const settings: AssessmentSettings = JSON.parse(submission.form.settings)?.assessment ?? {};
    const submittedData = JSON.parse(submission.data);

    const fields: AssessmentField[] = (schema.fields ?? []).filter(
      (f: AssessmentField) => f.correctAnswer !== undefined && f.correctAnswer !== null && f.correctAnswer !== ''
    );

    const passThreshold = settings.passThreshold ?? 60;

    let totalScore = 0;
    let maxScore = 0;
    const sections: AssessmentResult['sections'] = {};
    const fieldResults: AssessmentResult['fieldResults'] = [];

    for (const field of fields) {
      const pts = field.points ?? 1;
      const correct = isCorrect(submittedData[field.id], field.correctAnswer);
      const earned = correct ? pts : 0;

      maxScore += pts;
      totalScore += earned;

      fieldResults.push({
        fieldId: field.id,
        label: field.label,
        submittedAnswer: submittedData[field.id],
        correctAnswer: field.correctAnswer,
        isCorrect: correct,
        score: earned,
        maxScore: pts,
      });

      const sectionKey = field.section || '__default__';
      if (!sections[sectionKey]) {
        sections[sectionKey] = { score: 0, maxScore: 0, label: sectionKey === '__default__' ? 'General' : sectionKey };
      }
      sections[sectionKey].score += earned;
      sections[sectionKey].maxScore += pts;
    }

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const passed = percentage >= passThreshold;

    // Compute rank — count how many existing results scored strictly higher
    const existingResults = await prisma.processingResult.findMany({
      where: { formId: submission.formId, type: 'assessment' },
      select: { result: true },
    });

    const higherCount = existingResults.filter((r: (typeof existingResults)[number]) => {
      try {
        const parsed = JSON.parse(r.result) as AssessmentResult;
        return parsed.totalScore > totalScore;
      } catch {
        return false;
      }
    }).length;

    const rank = higherCount + 1;
    const totalParticipants = existingResults.length + 1;

    const result: AssessmentResult = {
      totalScore,
      maxScore,
      percentage,
      passed,
      rank,
      totalParticipants,
      sections,
      fieldResults,
    };

    // Upsert the processing result
    await prisma.processingResult.upsert({
      where: { submissionId },
      create: {
        submissionId,
        formId: submission.formId,
        type: 'assessment',
        result: JSON.stringify(result),
      },
      update: {
        result: JSON.stringify(result),
        processedAt: new Date(),
      },
    });

    await prisma.submission.update({
      where: { id: submissionId },
      data: { processingStatus: 'done' },
    });
  } catch (err) {
    console.error('[AssessmentProcessor] Error processing submission', submissionId, err);
    await prisma.submission.update({
      where: { id: submissionId },
      data: { processingStatus: 'failed' },
    }).catch(() => {});
  }
}
