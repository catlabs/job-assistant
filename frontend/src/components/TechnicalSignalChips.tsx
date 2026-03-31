import { getSignalLabel, type JobCriteriaSkill, type SkillCategory } from '../lib/jobs'
import { isTextValue, sortTechnicalSignals } from '../lib/job-presenters'

type TechnicalSignalChipsProps = {
  skills: JobCriteriaSkill[]
  limit?: number
  showLegend?: boolean
  technicalNotes?: string | null
  compact?: boolean
}

const skillCategoryLegendLabel: Record<SkillCategory, string> = {
  programming_language: 'Language',
  framework: 'Framework',
  backend: 'Backend',
  frontend: 'Frontend',
  ai_data: 'AI',
  cloud_infra: 'Cloud',
  devops: 'Infra',
  testing_quality: 'Quality',
  data_storage: 'Data',
  delivery_tool: 'Tooling',
  architecture_practice: 'Architecture',
}

const buildSkillKey = (skill: JobCriteriaSkill, index: number) =>
  `${skill.name}-${skill.category}-${skill.importance}-${index}`

function TechnicalSignalChips({
  skills,
  limit,
  showLegend = false,
  technicalNotes,
  compact = false,
}: TechnicalSignalChipsProps) {
  const sortedSkills = sortTechnicalSignals(skills)
  const visibleSkills = typeof limit === 'number' ? sortedSkills.slice(0, limit) : sortedSkills
  const hiddenSkillCount =
    typeof limit === 'number' ? Math.max(sortedSkills.length - visibleSkills.length, 0) : 0
  const legendCategories = showLegend
    ? sortedSkills.reduce<SkillCategory[]>((categories, skill) => {
        if (!categories.includes(skill.category)) {
          categories.push(skill.category)
        }
        return categories
      }, [])
    : []

  return (
    <>
      {visibleSkills.length > 0 ? (
        <div className="job-ui-technical-signals">
          <div
            className={
              compact
                ? 'job-ui-skill-chip-list job-ui-skill-chip-list-compact'
                : 'job-ui-skill-chip-list'
            }
          >
            {visibleSkills.map((skill, index) => (
              <span
                key={buildSkillKey(skill, index)}
                className="job-ui-skill-chip"
                data-category={skill.category}
                data-importance={skill.importance}
                title={getSignalLabel(skill.category)}
              >
                {skill.name}
              </span>
            ))}
            {hiddenSkillCount > 0 ? (
              <span className="job-ui-skill-overflow">+{hiddenSkillCount}</span>
            ) : null}
          </div>

          {showLegend && legendCategories.length > 0 ? (
            <div className="job-ui-skill-legend" aria-label="Skill category legend">
              {legendCategories.map((category) => (
                <span key={category} className="job-ui-skill-legend-item" data-category={category}>
                  <span className="job-ui-skill-legend-swatch" aria-hidden="true" />
                  <span>{skillCategoryLegendLabel[category]}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {isTextValue(technicalNotes) ? (
        <div className="job-detail-note-block">
          <p className="job-detail-list-title">Technical notes</p>
          <div className="profile-display-copy">{technicalNotes}</div>
        </div>
      ) : null}
    </>
  )
}

export default TechnicalSignalChips
