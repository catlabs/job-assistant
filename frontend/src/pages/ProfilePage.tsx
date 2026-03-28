import { Check, LoaderCircle, Save } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePageHeader } from '../components/PageHeaderContext'
import { ProfileUpdatePayload, fetchProfile, ProfileResponse, updateProfile } from '../lib/jobs'

const linesToList = (value: string): string[] =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)

const listToLines = (value: string[] | undefined): string => (Array.isArray(value) ? value.join('\n') : '')

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
  const [fitAnalysisEnabled, setFitAnalysisEnabled] = useState(false)
  const [lastSavedPayload, setLastSavedPayload] = useState<ProfileUpdatePayload | null>(null)

  const applyProfile = (profile: ProfileResponse) => {
    setProfileSummary(profile.profile_summary ?? '')
    setStrongFitSignalsText(listToLines(profile.job_fit_model?.strong_fit_signals))
    setAcceptableSignalsText(listToLines(profile.job_fit_model?.acceptable_but_intermediate_signals))
    setMisalignedSignalsText(listToLines(profile.job_fit_model?.misaligned_signals))
    setInterpretationRulesText(listToLines(profile.analysis_preferences_for_job_assistant?.interpretation_rules))
    setDecisionDimensionsText(listToLines(profile.analysis_preferences_for_job_assistant?.decision_dimensions))
    setClassificationLabels(profile.analysis_preferences_for_job_assistant?.classification_labels ?? [])
    setFitAnalysisEnabled(Boolean(profile.fit_analysis_enabled))
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
      subtitle: 'Edit the profile used by fit and decision analysis.',
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
    <div className="profile-page">
      <div className="content-scroll-area">
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
                <div className="profile-dashboard-column">
                  <section className="profile-subsection">
                    <div className={`profile-status ${fitAnalysisEnabled ? 'profile-status-enabled' : 'profile-status-disabled'}`}>
                      Fit analysis: {fitAnalysisEnabled ? 'Enabled' : 'Disabled'}
                    </div>

                    <label>
                      Human summary
                      <textarea
                        rows={5}
                        value={profileSummary}
                        onChange={(event) => setProfileSummary(event.target.value)}
                        placeholder="Short summary of your profile and priorities"
                      />
                    </label>
                  </section>

                  <section className="profile-subsection">
                    <h3>Profile explanation</h3>
                    {explanation ? <div className="decision-block">{explanation}</div> : <p className="muted">No explanation available yet.</p>}
                  </section>
                </div>

                <div className="profile-dashboard-column profile-dashboard-column-right">
                  <section className="profile-subsection">
                    <h3>Job fit model</h3>
                    <p className="muted">One item per line. Maximum 5 entries per bucket.</p>

                    <label>
                      Strong fit signals
                      <textarea
                        rows={5}
                        value={strongFitSignalsText}
                        onChange={(event) => setStrongFitSignalsText(event.target.value)}
                      />
                    </label>

                    <label>
                      Acceptable but intermediate signals
                      <textarea
                        rows={5}
                        value={acceptableSignalsText}
                        onChange={(event) => setAcceptableSignalsText(event.target.value)}
                      />
                    </label>

                    <label>
                      Misaligned signals
                      <textarea
                        rows={5}
                        value={misalignedSignalsText}
                        onChange={(event) => setMisalignedSignalsText(event.target.value)}
                      />
                    </label>
                  </section>

                  <section className="profile-subsection">
                    <h3>Analysis preferences</h3>
                    <label>
                      Classification labels (fixed)
                      <input type="text" value={labelsText} readOnly />
                    </label>
                    <p className="muted">Classification labels are fixed for this app and cannot be changed.</p>

                    <label>
                      Interpretation rules
                      <textarea
                        rows={4}
                        value={interpretationRulesText}
                        onChange={(event) => setInterpretationRulesText(event.target.value)}
                      />
                    </label>
                    <p className="muted">Maximum 3 entries.</p>

                    <label>
                      Decision dimensions
                      <textarea
                        rows={4}
                        value={decisionDimensionsText}
                        onChange={(event) => setDecisionDimensionsText(event.target.value)}
                      />
                    </label>
                    <p className="muted">Maximum 3 entries.</p>
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
