import {
  formatCompensationSummary,
  formatCreatedAt,
  getEmploymentTypeLabel,
  getSignalLabel,
  getWorkArrangementLabel,
  Job,
} from '../lib/jobs'

type JobCompareTableProps = {
  firstJob: Job
  secondJob: Job
}

const getSkillsText = (job: Job) => {
  const names = job.criteria.technical_signals.skills.map((skill) => skill.name)
  return names.length > 0 ? names.join(', ') : 'None'
}

function JobCompareTable({ firstJob, secondJob }: JobCompareTableProps) {
  return (
    <table className="compare-table">
      <tbody>
        <tr>
          <th scope="row">Field</th>
          <th>{firstJob.title || firstJob.criteria.job_basics.title || 'Untitled job'}</th>
          <th>{secondJob.title || secondJob.criteria.job_basics.title || 'Untitled job'}</th>
        </tr>
        <tr>
          <th scope="row">Company</th>
          <td>{firstJob.company || firstJob.criteria.job_basics.company_name || 'Unknown company'}</td>
          <td>{secondJob.company || secondJob.criteria.job_basics.company_name || 'Unknown company'}</td>
        </tr>
        <tr>
          <th scope="row">Location</th>
          <td>{firstJob.location || firstJob.criteria.job_basics.location_text || 'Unknown location'}</td>
          <td>{secondJob.location || secondJob.criteria.job_basics.location_text || 'Unknown location'}</td>
        </tr>
        <tr>
          <th scope="row">Arrangement</th>
          <td>{getWorkArrangementLabel(firstJob.criteria.personal_life_signals.work_arrangement)}</td>
          <td>{getWorkArrangementLabel(secondJob.criteria.personal_life_signals.work_arrangement)}</td>
        </tr>
        <tr>
          <th scope="row">Employment</th>
          <td>{getEmploymentTypeLabel(firstJob.criteria.job_basics.employment_type)}</td>
          <td>{getEmploymentTypeLabel(secondJob.criteria.job_basics.employment_type)}</td>
        </tr>
        <tr>
          <th scope="row">Seniority</th>
          <td>{getSignalLabel(firstJob.criteria.job_basics.seniority_level)}</td>
          <td>{getSignalLabel(secondJob.criteria.job_basics.seniority_level)}</td>
        </tr>
        <tr>
          <th scope="row">Summary</th>
          <td>{firstJob.criteria.job_basics.job_summary || 'Not available'}</td>
          <td>{secondJob.criteria.job_basics.job_summary || 'Not available'}</td>
        </tr>
        <tr>
          <th scope="row">Skills</th>
          <td>{getSkillsText(firstJob)}</td>
          <td>{getSkillsText(secondJob)}</td>
        </tr>
        <tr>
          <th scope="row">Compensation</th>
          <td>{formatCompensationSummary(firstJob.criteria.financial_signals)}</td>
          <td>{formatCompensationSummary(secondJob.criteria.financial_signals)}</td>
        </tr>
        <tr>
          <th scope="row">Extraction confidence</th>
          <td>{getSignalLabel(firstJob.criteria.extraction_quality.confidence_level)}</td>
          <td>{getSignalLabel(secondJob.criteria.extraction_quality.confidence_level)}</td>
        </tr>
        <tr>
          <th scope="row">Created date</th>
          <td>{formatCreatedAt(firstJob.created_at)}</td>
          <td>{formatCreatedAt(secondJob.created_at)}</td>
        </tr>
        <tr>
          <th scope="row">URL</th>
          <td>
            {firstJob.url ? (
              <a href={firstJob.url} target="_blank" rel="noreferrer">
                {firstJob.url}
              </a>
            ) : (
              <span className="muted">Not available</span>
            )}
          </td>
          <td>
            {secondJob.url ? (
              <a href={secondJob.url} target="_blank" rel="noreferrer">
                {secondJob.url}
              </a>
            ) : (
              <span className="muted">Not available</span>
            )}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

export default JobCompareTable
