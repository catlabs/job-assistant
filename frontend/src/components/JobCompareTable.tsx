import { formatCreatedAt, Job } from '../lib/jobs'

type JobCompareTableProps = {
  firstJob: Job
  secondJob: Job
}

function JobCompareTable({ firstJob, secondJob }: JobCompareTableProps) {
  return (
    <table className="compare-table">
      <tbody>
        <tr>
          <th scope="row">Field</th>
          <th>{firstJob.title || 'Untitled job'}</th>
          <th>{secondJob.title || 'Untitled job'}</th>
        </tr>
        <tr>
          <th scope="row">Title</th>
          <td>{firstJob.title || 'Untitled job'}</td>
          <td>{secondJob.title || 'Untitled job'}</td>
        </tr>
        <tr>
          <th scope="row">Company</th>
          <td>{firstJob.company || 'Unknown company'}</td>
          <td>{secondJob.company || 'Unknown company'}</td>
        </tr>
        <tr>
          <th scope="row">Location</th>
          <td>{firstJob.location || 'Unknown location'}</td>
          <td>{secondJob.location || 'Unknown location'}</td>
        </tr>
        <tr>
          <th scope="row">Source</th>
          <td>{firstJob.source || 'unknown'}</td>
          <td>{secondJob.source || 'unknown'}</td>
        </tr>
        <tr>
          <th scope="row">Seniority</th>
          <td>{firstJob.analysis?.seniority || 'Unknown'}</td>
          <td>{secondJob.analysis?.seniority || 'Unknown'}</td>
        </tr>
        <tr>
          <th scope="row">Summary</th>
          <td>{firstJob.analysis?.summary || 'Not available'}</td>
          <td>{secondJob.analysis?.summary || 'Not available'}</td>
        </tr>
        <tr>
          <th scope="row">Keywords</th>
          <td>
            {firstJob.analysis?.keywords && firstJob.analysis.keywords.length > 0
              ? firstJob.analysis.keywords.join(', ')
              : 'None'}
          </td>
          <td>
            {secondJob.analysis?.keywords && secondJob.analysis.keywords.length > 0
              ? secondJob.analysis.keywords.join(', ')
              : 'None'}
          </td>
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
