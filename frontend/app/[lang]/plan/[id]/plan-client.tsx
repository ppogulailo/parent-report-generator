'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { STRINGS, type Language } from '../../../i18n';
import ReportView, {
  type ReportSection,
  type ReportSeverity,
} from '../../ReportView';
import PlanLinkCard from '../../PlanLinkCard';
import { clearPlanPointer } from '../../v1/plan-store';

/**
 * A saved plan, reopened from its private link.
 *
 * Renders through the same ReportView as the live generation, from the same
 * stored sections the parent originally saw. A plan still being written polls
 * to completion; one that is gone — expired at 90 days, or deleted — says so
 * plainly and offers the assessment again, because "your link is dead" with no
 * road forward is how a worried parent gives up.
 */

const EXTRA = {
  en: {
    loading: 'Opening your plan…',
    writingNote: 'Your plan is still being written. This page will update on its own.',
    goneHeading: 'This plan is no longer available',
    goneBody:
      'Saved plans are kept for 90 days and are removed permanently when they expire or when their deletion is requested. You can take the assessment again at any time — it takes about ten minutes.',
    failedHeading: 'This plan could not be completed',
    failedBody: 'Something went wrong while this plan was being written. You can take the assessment again — your answers were not kept.',
    retake: 'Take the assessment',
    errorBody: 'We could not open your plan just now. Please try again.',
    retry: 'Try again',
    print: 'Save / Print',
    pdf: 'Download PDF',
    linkLabel: 'Your private link',
    expiresBefore: 'This private link works until ',
    expiresAfter:
      ', then this plan is deleted automatically. Download the PDF or print a copy to keep it beyond that.',
    copyLink: 'Copy link',
    copied: 'Copied',
    copiedAnnouncement: 'Link copied to clipboard.',
    deleteButton: 'Delete my data',
    deleteConfirm:
      'Delete your plan, your answers, and everything else we hold about this assessment? This cannot be undone.',
    deletedHeading: 'Everything has been deleted',
    deletedBody:
      'Your plan, your answers, and the records of how it was generated are gone. Nothing about your family remains. If you ever want a plan again, the assessment is always available.',
  },
  es: {
    loading: 'Abriendo tu plan…',
    writingNote: 'Tu plan todavía se está escribiendo. Esta página se actualizará sola.',
    goneHeading: 'Este plan ya no está disponible',
    goneBody:
      'Los planes guardados se conservan durante 90 días y se eliminan permanentemente cuando expiran o cuando se solicita su eliminación. Puedes hacer la evaluación de nuevo en cualquier momento — toma unos diez minutos.',
    failedHeading: 'Este plan no se pudo completar',
    failedBody: 'Algo salió mal mientras se escribía este plan. Puedes hacer la evaluación de nuevo — tus respuestas no se conservaron.',
    retake: 'Hacer la evaluación',
    errorBody: 'No pudimos abrir tu plan en este momento. Inténtalo de nuevo.',
    retry: 'Intentar de nuevo',
    print: 'Guardar / Imprimir',
    pdf: 'Descargar PDF',
    linkLabel: 'Tu enlace privado',
    expiresBefore: 'Este enlace privado funciona hasta el ',
    expiresAfter:
      ', después este plan se elimina automáticamente. Descarga el PDF o imprime una copia para conservarlo.',
    copyLink: 'Copiar enlace',
    copied: 'Copiado',
    copiedAnnouncement: 'Enlace copiado al portapapeles.',
    deleteButton: 'Eliminar mis datos',
    deleteConfirm:
      '¿Eliminar tu plan, tus respuestas y todo lo demás que guardamos sobre esta evaluación? Esto no se puede deshacer.',
    deletedHeading: 'Todo ha sido eliminado',
    deletedBody:
      'Tu plan, tus respuestas y los registros de cómo se generó ya no existen. No queda nada sobre tu familia. Si algún día quieres un plan de nuevo, la evaluación siempre está disponible.',
  },
} as const;

interface PlanPayload {
  success: boolean;
  status: 'generating' | 'complete' | 'failed';
  language: Language;
  severity: { tierId: string; label: string; description: string };
  domainScores: Record<string, number>;
  topDomains: string[];
  sections: ReportSection[] | null;
  expiresAt: string;
}

type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'gone' }
  | { kind: 'failed' }
  | { kind: 'deleted' }
  | { kind: 'ready'; plan: PlanPayload };

export default function PlanClient({
  language,
  planId,
  domainDescriptions,
  pdfAvailable,
}: {
  language: Language;
  planId: string;
  domainDescriptions: Record<string, string>;
  pdfAvailable: boolean;
}) {
  const t = STRINGS[language];
  const x = EXTRA[language];
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [deleting, setDeleting] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPlan = useCallback(async () => {
    try {
      const res = await fetch(`/api/plan/${planId}`, { cache: 'no-store' });
      if (res.status === 404) {
        clearPlanPointer();
        setState({ kind: 'gone' });
        return;
      }
      const body = (await res.json()) as PlanPayload;
      if (!res.ok || !body.success) {
        setState({ kind: 'error' });
        return;
      }
      if (body.status === 'failed') {
        setState({ kind: 'failed' });
        return;
      }
      setState({ kind: 'ready', plan: body });
      if (body.status === 'generating') {
        // Reopened mid-generation: poll until the plan lands. 2s is gentle on
        // the server and invisible to the reader.
        pollTimer.current = setTimeout(() => void fetchPlan(), 2000);
      }
    } catch {
      setState({ kind: 'error' });
    }
  }, [planId]);

  useEffect(() => {
    void fetchPlan();
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [fetchPlan]);

  async function deleteEverything() {
    // The card's confirm dialog has already run by the time this is called.
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/plan/${planId}`, { method: 'DELETE' });
      if (res.ok) {
        clearPlanPointer();
        setState({ kind: 'deleted' });
      } else {
        setState((s) => s); // keep the plan; the notice below explains
        window.alert(x.errorBody);
      }
    } catch {
      window.alert(x.errorBody);
    } finally {
      setDeleting(false);
    }
  }

  if (state.kind === 'loading') {
    return <CenterCard><p className="step-hint">{x.loading}</p></CenterCard>;
  }

  if (state.kind === 'error') {
    return (
      <CenterCard>
        <p className="error" role="alert">{x.errorBody}</p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setState({ kind: 'loading' });
            void fetchPlan();
          }}
        >
          {x.retry}
        </button>
      </CenterCard>
    );
  }

  if (state.kind === 'gone' || state.kind === 'failed' || state.kind === 'deleted') {
    const heading =
      state.kind === 'gone'
        ? x.goneHeading
        : state.kind === 'failed'
          ? x.failedHeading
          : x.deletedHeading;
    const body =
      state.kind === 'gone'
        ? x.goneBody
        : state.kind === 'failed'
          ? x.failedBody
          : x.deletedBody;
    return (
      <CenterCard>
        <h1 className="qgroup-title">{heading}</h1>
        <p>{body}</p>
        <Link className="btn btn-primary" href={`/${language}`}>
          {x.retake}
        </Link>
      </CenterCard>
    );
  }

  const { plan } = state;
  const writing = plan.status === 'generating';
  const severity: ReportSeverity = plan.severity;
  const expires = new Date(plan.expiresAt).toLocaleDateString(
    language === 'es' ? 'es-ES' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' },
  );

  return (
    <main className="block" style={{ maxWidth: '52rem', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {writing ? (
        <p className="step-hint no-print" role="status">{x.writingNote}</p>
      ) : null}
      {!writing ? (
        <PlanLinkCard
          planUrl={typeof window === 'undefined' ? '' : window.location.href}
          pdfHref={pdfAvailable ? `/api/plan/${planId}/pdf` : null}
          copy={{
            label: x.linkLabel,
            noteBefore: x.expiresBefore,
            noteEmphasis: expires,
            noteAfter: x.expiresAfter,
            copyLink: x.copyLink,
            copied: x.copied,
            copiedAnnouncement: x.copiedAnnouncement,
            downloadPdf: x.pdf,
            print: x.print,
            deleteData: x.deleteButton,
            deleteConfirm: x.deleteConfirm,
          }}
          onDelete={() => void deleteEverything()}
        />
      ) : null}
      <ReportView
        sections={plan.sections ?? []}
        severity={severity}
        domainScores={plan.domainScores}
        domainDescriptions={domainDescriptions}
        topDomains={plan.topDomains}
        language={language}
        writing={writing}
        copy={{
          writingPlaceholder: t.writingPlaceholder,
          planLevelLabel: t.planLevelLabel,
          domainScoresHeading: t.domainScoresHeading,
          domainScoresHint: t.domainScoresHint,
          topPrioritiesHeading: t.topPrioritiesHeading,
          actionPlanHeading: t.actionPlanHeading,
          readyHeading: t.doneTitle,
          readySub: t.doneSub,
          writingHeading: t.writingTitle,
          writingSub: t.writingSub,
          workshopsUnlinked: '',
          openWorkshop: language === 'es' ? 'Abrir en ASAP Community' : 'Open in ASAP Community',
        }}
      />
    </main>
  );
}

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
      }}
    >
      <div
        className="crisis-card"
        style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-start' }}
      >
        {children}
      </div>
    </main>
  );
}
