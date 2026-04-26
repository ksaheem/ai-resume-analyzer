import React, { useMemo } from 'react'

type JobSuggestion = {
  title: string;
  matchReason: string;
  seniority: 'Junior' | 'Mid' | 'Senior';
  applyUrl?: string;
}

const badgeColors: Record<JobSuggestion['seniority'], string> = {
  Junior: 'bg-blue-100 text-blue-700',
  Mid: 'bg-amber-100 text-amber-700',
  Senior: 'bg-purple-100 text-purple-700',
}

const getSeniorityFromScore = (score: number): JobSuggestion['seniority'] => {
  if (score >= 80) return 'Senior'
  if (score >= 60) return 'Mid'
  return 'Junior'
}

const generateSuggestions = (
  atsScore: number,
  jobTitle?: string
): JobSuggestion[] => {
  const seniority = getSeniorityFromScore(atsScore)
  const baseTitle = jobTitle && jobTitle.trim().length > 0 ? jobTitle : 'Role'

  const titlesBySeniority: Record<JobSuggestion['seniority'], string[]> = {
    Junior: [
      `Associate ${baseTitle}`,
      `${baseTitle} Intern`,
      `Junior ${baseTitle}`,
    ],
    Mid: [
      `${baseTitle}`,
      `${baseTitle} (Generalist)`,
      `${baseTitle} - Growth`,
    ],
    Senior: [
      `Senior ${baseTitle}`,
      `${baseTitle} Lead`,
      `Principal ${baseTitle}`,
    ],
  }

  const reasonByBand: Record<JobSuggestion['seniority'], string> = {
    Junior: 'Your ATS score suggests a good foundation; consider gaining breadth with entry-level roles.',
    Mid: 'Solid ATS alignment; target standard roles where your strengths map well.',
    Senior: 'High ATS alignment; you may qualify for leadership or high-impact positions.',
  }

  const titles = titlesBySeniority[seniority]

  return titles.map((t) => ({
    title: t,
    seniority,
    matchReason: reasonByBand[seniority],
  }))
}

const JobCard = ({ suggestion }: { suggestion: JobSuggestion }) => {
  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-gray-900">{suggestion.title}</h4>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeColors[suggestion.seniority]}`}>
          {suggestion.seniority}
        </span>
      </div>
      <p className="text-gray-600 text-sm">{suggestion.matchReason}</p>
      <div className="flex items-center gap-2">
        <img src="/icons/pin.svg" alt="fit" className="w-4 h-4" />
        <span className="text-gray-500 text-xs">Suggested based on ATS score</span>
      </div>
      {suggestion.applyUrl && (
        <a
          href={suggestion.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center justify-center px-3 py-2 rounded-lg bg-black text-white text-sm font-medium hover:opacity-90"
        >
          View & Apply
        </a>
      )}
    </div>
  )
}

const JobSuggestions = ({ atsScore, jobTitle }: { atsScore: number; jobTitle?: string }) => {
  const suggestions = useMemo(() => generateSuggestions(atsScore, jobTitle), [atsScore, jobTitle])

  const headerBg = atsScore >= 70 ? 'from-green-50' : atsScore >= 50 ? 'from-amber-50' : 'from-red-50'

  return (
    <section className={`bg-gradient-to-b ${headerBg} to-white rounded-2xl shadow-md w-full p-6`}>
      <div className="flex items-center gap-3 mb-4">
        <img src="/icons/info.svg" alt="suggestions" className="w-6 h-6" />
        <h3 className="text-xl font-bold">Recommended Roles</h3>
      </div>
      <p className="text-gray-600 mb-6 text-sm">
        These roles are suggested based on your ATS score. Improve your score to unlock higher-seniority matches.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {suggestions.map((s) => (
          <JobCard key={`${s.title}-${s.seniority}`} suggestion={s} />
        ))}
      </div>
    </section>
  )
}

export default JobSuggestions


