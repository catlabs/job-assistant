import { Check, LoaderCircle, PencilLine, Save } from 'lucide-react'
import { type TextareaHTMLAttributes, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getButtonClassName } from '../components/Button'
import { usePageHeader } from '../components/PageHeaderContext'
import { ProfileUpdatePayload, fetchProfile, ProfileResponse, updateProfile } from '../lib/jobs'

type EditableSection =
  | 'summary'
  | 'strongFitSignals'
  | 'acceptableSignals'
  | 'misalignedSignals'
  | 'classificationLabels'
  | 'interpretationRules'
  | 'decisionDimensions'

const linesToList = (value: string): string[] =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)

const listToLines = (value: string[] | undefined): string => (Array.isArray(value) ? value.join('\n') : '')
const profileEditToggleClassName = getButtonClassName({ variant: 'ghost', size: 'icon', className: 'profile-edit-toggle' })

const resizeTextarea = (textarea: HTMLTextAreaElement | null) => {
  if (!textarea) {
    return
  }

  textarea.style.height = '0px'
  textarea.style.height = `${textarea.scrollHeight}px`
}

type AutosizeTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  minRows?: number
}

function AutosizeTextarea({ className = '', minRows = 3, onChange, value, ...props }: AutosizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useLayoutEffect(() => {
    resizeTextarea(textareaRef.current)
  }, [value])

  return (
    <textarea
      {...props}
      ref={textareaRef}
      rows={minRows}
      value={value}
      onChange={(event) => {
        resizeTextarea(event.currentTarget)
        onChange?.(event)
      }}
      className={['profile-inline-textarea', className].filter(Boolean).join(' ')}
    />
  )
}

function ProfileTextDisplay({ value, emptyMessage }: { value: string; emptyMessage: string }) {
  if (!value.trim()) {
    return <p className="muted">{emptyMessage}</p>
  }

  return <div className="profile-display-copy">{value}</div>
}

function ProfileListDisplay({ value, emptyMessage }: { value: string; emptyMessage: string }) {
  const items = linesToList(value)

  if (items.length === 0) {
    return <p className="muted">{emptyMessage}</p>
  }

  return (
    <ul className="profile-list-display">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  )
}

const buildProfilePayload = (values: {
  profileSummary: string
  strongFitSignalsText: string
  acceptableSignalsText: string
  misalignedSignalsText: string
  interpretationRulesText: string
  decisionDimensionsText: string
  classificationLabels: string[]
}): ProfileUpdatePayload => ({
  profile_summary: values.profileSummary,
  job_fit_model: {
    strong_fit_signals: linesToList(values.strongFitSignalsText),
    acceptable_but_intermediate_signals: linesToList(values.acceptableSignalsText),
    misaligned_signals: linesToList(values.misalignedSignalsText),
  },
  analysis_preferences_for_job_assistant: {
    classification_labels: values.classificationLabels,
    interpretation_rules: linesToList(values.interpretationRulesText),
    decision_dimensions: linesToList(values.decisionDimensionsText),
  },
})

function ProfilePage() {
  const [editingSections, setEditingSections] = useState({
    summary: false,
    strongFitSignals: false,
    acceptableSignals: false,
    misalignedSignals: false,
    classificationLabels: false,
    interpretationRules: false,
    decisionDimensions: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  const [explanation, setExplanation] = useState('')

  const [profileSummary, setProfileSummary] = useState('')
  const [strongFitSignalsText, setStrongFitSignalsText] = useState('')
  const [acceptableSignalsText, setAcceptableSignalsText] = useState('')
  const [misalignedSignalsText, setMisalignedSignalsText] = useState('')
  const [interpretationRulesText, setInterpretationRulesText] = useState('')
  const [decisionDimensionsText, setDecisionDimensionsText] = useState('')
  const [classificationLabels, setClassificationLabels] = useState<string[]>([])
  const [lastSavedPayload, setLastSavedPayload] = useState<ProfileUpdatePayload | null>(null)

  const toggleSectionEditing = useCallback((section: EditableSection) => {
    setEditingSections((current) => ({
      ...current,
      [section]: !current[section],
    }))
  }, [])

  const applyProfile = (profile: ProfileResponse) => {
    setProfileSummary(profile.profile_summary ?? '')
    setStrongFitSignalsText(listToLines(profile.job_fit_model?.strong_fit_signals))
    setAcceptableSignalsText(listToLines(profile.job_fit_model?.acceptable_but_intermediate_signals))
    setMisalignedSignalsText(listToLines(profile.job_fit_model?.misaligned_signals))
    setInterpretationRulesText(listToLines(profile.analysis_preferences_for_job_assistant?.interpretation_rules))
    setDecisionDimensionsText(listToLines(profile.analysis_preferences_for_job_assistant?.decision_dimensions))
    setClassificationLabels(profile.analysis_preferences_for_job_assistant?.classification_labels ?? [])
    setExplanation(profile.explanation?.trim() ?? '')
    setLastSavedPayload(
      buildProfilePayload({
        profileSummary: profile.profile_summary ?? '',
        strongFitSignalsText: listToLines(profile.job_fit_model?.strong_fit_signals),
        acceptableSignalsText: listToLines(profile.job_fit_model?.acceptable_but_intermediate_signals),
        misalignedSignalsText: listToLines(profile.job_fit_model?.misaligned_signals),
        interpretationRulesText: listToLines(profile.analysis_preferences_for_job_assistant?.interpretation_rules),
        decisionDimensionsText: listToLines(profile.analysis_preferences_for_job_assistant?.decision_dimensions),
        classificationLabels: profile.analysis_preferences_for_job_assistant?.classification_labels ?? [],
      }),
    )
  }

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true)
      setError('')

      try {
        const profile = await fetchProfile()
        applyProfile(profile)
      } catch (profileLoadError) {
        if (profileLoadError instanceof Error) {
          setError(profileLoadError.message)
        } else {
          setError('Could not load profile.')
        }
      } finally {
        setLoading(false)
      }
    }

    void loadProfile()
  }, [])

  const labelsText = useMemo(() => classificationLabels.join(', '), [classificationLabels])
  const draftPayload = useMemo(
    () =>
      buildProfilePayload({
        profileSummary,
        strongFitSignalsText,
        acceptableSignalsText,
        misalignedSignalsText,
        interpretationRulesText,
        decisionDimensionsText,
        classificationLabels,
      }),
    [
      acceptableSignalsText,
      classificationLabels,
      decisionDimensionsText,
      interpretationRulesText,
      misalignedSignalsText,
      profileSummary,
      strongFitSignalsText,
    ],
  )
  const isDirty = useMemo(() => {
    if (!lastSavedPayload) {
      return false
    }

    return JSON.stringify(draftPayload) !== JSON.stringify(lastSavedPayload)
  }, [draftPayload, lastSavedPayload])

  const handleSave = useCallback(async () => {
    if (!isDirty || saveLoading || loading) {
      return
    }

    setSaveError('')
    setSaveSuccess('')
    setSaveLoading(true)

    try {
      const saved = await updateProfile(draftPayload)
      applyProfile(saved)
      setSaveSuccess('Profile saved.')
    } catch (profileSaveError) {
      if (profileSaveError instanceof Error) {
        setSaveError(profileSaveError.message)
      } else {
        setSaveError('Could not save profile.')
      }
    } finally {
      setSaveLoading(false)
    }
  }, [
    draftPayload,
    isDirty,
    loading,
    saveLoading,
  ])

  useEffect(() => {
    if (saveSuccess && isDirty) {
      setSaveSuccess('')
    }
  }, [isDirty, saveSuccess])

  const saveButtonLabel = saveLoading
    ? 'Saving changes'
    : isDirty
      ? 'Save changes'
      : saveSuccess
        ? 'Saved'
        : 'Save profile'

  const saveButtonIcon = useMemo(() => {
    if (saveLoading) {
      return <LoaderCircle size={15} className="spin" />
    }

    if (saveSuccess && !isDirty) {
      return <Check size={15} />
    }

    return <Save size={15} />
  }, [isDirty, saveLoading, saveSuccess])

  const pageHeaderConfig = useMemo(
    () => ({
      title: 'Profile',
      actions: [
        {
          key: 'save',
          label: saveButtonLabel,
          onClick: () => {
            void handleSave()
          },
          icon: saveButtonIcon,
          variant: 'secondary' as const,
          className: `profile-save-action ${isDirty ? 'profile-save-action-dirty' : ''}`.trim(),
          disabled: saveLoading || loading || !isDirty,
        },
      ],
    }),
    [handleSave, isDirty, loading, saveButtonIcon, saveButtonLabel, saveLoading],
  )

  usePageHeader(pageHeaderConfig)

  return (
    <div className="profile-page profile-page-static">
      <div className="content-static-area profile-static-area">
        {(loading || error) && (
          <section className="profile-block">
            {loading && <p>Loading profile…</p>}
            {!loading && error && <p className="error">{error}</p>}
          </section>
        )}

        {!loading && !error && (
          <>
            <section className="profile-block profile-dashboard-block">
              <div className="profile-dashboard-grid">
                <div className="profile-dashboard-column profile-dashboard-column-scroll">
                  <section className="profile-subsection">
                    <div className="profile-section-header profile-section-header-editable">
                      <div className="profile-section-header-copy">
                        <h3 className="profile-section-title">Human summary</h3>
                      </div>

                      <button
                        type="button"
                        className={profileEditToggleClassName}
                        onClick={() => toggleSectionEditing('summary')}
                        aria-pressed={editingSections.summary}
                        aria-label={editingSections.summary ? 'Finish editing human summary' : 'Edit human summary'}
                        title={editingSections.summary ? 'Finish editing human summary' : 'Edit human summary'}
                      >
                        {editingSections.summary ? <Check size={14} /> : <PencilLine size={14} />}
                      </button>
                    </div>

                    {editingSections.summary ? (
                      <label>
                        <span className="profile-field-label">Summary</span>
                        <AutosizeTextarea
                          minRows={4}
                          value={profileSummary}
                          onChange={(event) => setProfileSummary(event.target.value)}
                          placeholder="Short summary of your profile and priorities"
                          autoFocus
                        />
                      </label>
                    ) : (
                      <ProfileTextDisplay value={profileSummary} emptyMessage="No profile summary added yet." />
                    )}
                  </section>

                  <section className="profile-subsection">
                    <h3 className="profile-section-title">Profile explanation</h3>
                    {explanation ? <div className="profile-display-copy">{explanation}</div> : <p className="muted">No explanation available yet.</p>}
                  </section>
                </div>

                <div className="profile-dashboard-column profile-dashboard-column-right profile-dashboard-column-scroll">
                  <section className="profile-subsection">
                    <div className="profile-section-header profile-section-header-editable">
                      <div className="profile-section-header-copy">
                        <h3 className="profile-section-title">Strong fit signals</h3>
                        <p className="muted">One item per line. Maximum 5 entries per bucket.</p>
                      </div>

                      <button
                        type="button"
                        className={profileEditToggleClassName}
                        onClick={() => toggleSectionEditing('strongFitSignals')}
                        aria-pressed={editingSections.strongFitSignals}
                        aria-label={editingSections.strongFitSignals ? 'Finish editing strong fit signals' : 'Edit strong fit signals'}
                        title={editingSections.strongFitSignals ? 'Finish editing strong fit signals' : 'Edit strong fit signals'}
                      >
                        {editingSections.strongFitSignals ? <Check size={14} /> : <PencilLine size={14} />}
                      </button>
                    </div>

                    {editingSections.strongFitSignals ? (
                      <label>
                        <span className="profile-field-label">Strong fit signals</span>
                        <AutosizeTextarea
                          minRows={4}
                          value={strongFitSignalsText}
                          onChange={(event) => setStrongFitSignalsText(event.target.value)}
                          autoFocus
                        />
                      </label>
                    ) : (
                      <ProfileListDisplay value={strongFitSignalsText} emptyMessage="No strong-fit signals defined." />
                    )}
                  </section>

                  <section className="profile-subsection">
                    <div className="profile-section-header profile-section-header-editable">
                      <div className="profile-section-header-copy">
                        <h3 className="profile-section-title">Acceptable signals</h3>
                      </div>

                      <button
                        type="button"
                        className={profileEditToggleClassName}
                        onClick={() => toggleSectionEditing('acceptableSignals')}
                        aria-pressed={editingSections.acceptableSignals}
                        aria-label={editingSections.acceptableSignals ? 'Finish editing acceptable signals' : 'Edit acceptable signals'}
                        title={editingSections.acceptableSignals ? 'Finish editing acceptable signals' : 'Edit acceptable signals'}
                      >
                        {editingSections.acceptableSignals ? <Check size={14} /> : <PencilLine size={14} />}
                      </button>
                    </div>

                    {editingSections.acceptableSignals ? (
                      <label>
                        <span className="profile-field-label">Acceptable signals</span>
                        <AutosizeTextarea
                          minRows={4}
                          value={acceptableSignalsText}
                          onChange={(event) => setAcceptableSignalsText(event.target.value)}
                        />
                      </label>
                    ) : (
                      <ProfileListDisplay value={acceptableSignalsText} emptyMessage="No intermediate signals defined." />
                    )}
                  </section>

                  <section className="profile-subsection">
                    <div className="profile-section-header profile-section-header-editable">
                      <div className="profile-section-header-copy">
                        <h3 className="profile-section-title">Misaligned signals</h3>
                      </div>

                      <button
                        type="button"
                        className={profileEditToggleClassName}
                        onClick={() => toggleSectionEditing('misalignedSignals')}
                        aria-pressed={editingSections.misalignedSignals}
                        aria-label={editingSections.misalignedSignals ? 'Finish editing misaligned signals' : 'Edit misaligned signals'}
                        title={editingSections.misalignedSignals ? 'Finish editing misaligned signals' : 'Edit misaligned signals'}
                      >
                        {editingSections.misalignedSignals ? <Check size={14} /> : <PencilLine size={14} />}
                      </button>
                    </div>

                    {editingSections.misalignedSignals ? (
                      <label>
                        <span className="profile-field-label">Misaligned signals</span>
                        <AutosizeTextarea
                          minRows={4}
                          value={misalignedSignalsText}
                          onChange={(event) => setMisalignedSignalsText(event.target.value)}
                        />
                      </label>
                    ) : (
                      <ProfileListDisplay value={misalignedSignalsText} emptyMessage="No misaligned signals defined." />
                    )}
                  </section>

                  <section className="profile-subsection">
                    <div className="profile-section-header profile-section-header-editable">
                      <div className="profile-section-header-copy">
                        <h3 className="profile-section-title">Classification labels</h3>
                      </div>

                      <button
                        type="button"
                        className={profileEditToggleClassName}
                        disabled
                        aria-label="Classification labels are fixed"
                        title="Classification labels are fixed"
                      >
                        <PencilLine size={14} />
                      </button>
                    </div>

                    <div className="profile-inline-meta">
                      <span className="profile-field-badge">Fixed</span>
                    </div>
                    <div className="profile-chip-list" aria-label={`Classification labels: ${labelsText || 'None'}`}>
                      {classificationLabels.map((label) => (
                        <span key={label} className="profile-chip">
                          {label}
                        </span>
                      ))}
                    </div>
                    <p className="muted">Classification labels are fixed for this app and cannot be changed.</p>
                  </section>

                  <section className="profile-subsection">
                    <div className="profile-section-header profile-section-header-editable">
                      <div className="profile-section-header-copy">
                        <h3 className="profile-section-title">Interpretation rules</h3>
                        <p className="profile-field-meta">Maximum 3 entries</p>
                      </div>

                      <button
                        type="button"
                        className={profileEditToggleClassName}
                        onClick={() => toggleSectionEditing('interpretationRules')}
                        aria-pressed={editingSections.interpretationRules}
                        aria-label={editingSections.interpretationRules ? 'Finish editing interpretation rules' : 'Edit interpretation rules'}
                        title={editingSections.interpretationRules ? 'Finish editing interpretation rules' : 'Edit interpretation rules'}
                      >
                        {editingSections.interpretationRules ? <Check size={14} /> : <PencilLine size={14} />}
                      </button>
                    </div>

                    {editingSections.interpretationRules ? (
                      <label>
                        <span className="profile-field-label">Interpretation rules</span>
                        <AutosizeTextarea
                          minRows={3}
                          value={interpretationRulesText}
                          onChange={(event) => setInterpretationRulesText(event.target.value)}
                          autoFocus
                        />
                      </label>
                    ) : (
                      <ProfileListDisplay value={interpretationRulesText} emptyMessage="No interpretation rules defined." />
                    )}
                  </section>

                  <section className="profile-subsection">
                    <div className="profile-section-header profile-section-header-editable">
                      <div className="profile-section-header-copy">
                        <h3 className="profile-section-title">Decision dimensions</h3>
                        <p className="profile-field-meta">Maximum 3 entries</p>
                      </div>

                      <button
                        type="button"
                        className={profileEditToggleClassName}
                        onClick={() => toggleSectionEditing('decisionDimensions')}
                        aria-pressed={editingSections.decisionDimensions}
                        aria-label={editingSections.decisionDimensions ? 'Finish editing decision dimensions' : 'Edit decision dimensions'}
                        title={editingSections.decisionDimensions ? 'Finish editing decision dimensions' : 'Edit decision dimensions'}
                      >
                        {editingSections.decisionDimensions ? <Check size={14} /> : <PencilLine size={14} />}
                      </button>
                    </div>

                    {editingSections.decisionDimensions ? (
                      <label>
                        <span className="profile-field-label">Decision dimensions</span>
                        <AutosizeTextarea
                          minRows={3}
                          value={decisionDimensionsText}
                          onChange={(event) => setDecisionDimensionsText(event.target.value)}
                        />
                      </label>
                    ) : (
                      <ProfileListDisplay value={decisionDimensionsText} emptyMessage="No decision dimensions defined." />
                    )}
                  </section>
                </div>
              </div>
            </section>

            <section className="profile-block profile-actions-block">
              {saveError && <p className="error">{saveError}</p>}
              {saveSuccess && <p className="success">{saveSuccess}</p>}
            </section>
          </>
        )}
      </div>
    </div>
  )
}

export default ProfilePage
