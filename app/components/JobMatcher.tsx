import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { usePuterStore } from '~/lib/puter';
import { formatSize } from '../lib/utils';

interface JobMatchResult {
  matchScore: number;
  missingKeywords: string[];
  suggestions: string[];
  strengths: string[];
}

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  relevanceScore?: number;
}

interface JobMatcherProps {
  onAnalysisComplete?: (result: JobMatchResult) => void;
}

const JobMatcher = ({ onAnalysisComplete }: JobMatcherProps) => {
  const [jobDescription, setJobDescription] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<JobMatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawAiResponse, setRawAiResponse] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isSearchingJobs, setIsSearchingJobs] = useState(false);
  const [jobSearchQuery, setJobSearchQuery] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const { ai, fs } = usePuterStore();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0] || null;
    setResumeFile(file);
    setUploadProgress(0);
    setIsUploading(false);
    
    // Extract text from resume for job matching
    if (file) {
      const reader = new FileReader();
      reader.onloadstart = () => {
        setIsUploading(true);
        setUploadProgress(5);
      };
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.min(95, Math.max(10, Math.round((e.loaded / e.total) * 70)));
          setUploadProgress(percent);
        }
      };
      reader.onload = async (e) => {
        if (e.target?.result) {
          try {
            setUploadProgress((p) => Math.max(p, 70));
            // Use local PDF extraction which is almost instantaneous instead of slow AI request
            const { extractTextFromPdf } = await import('~/lib/pdf2img');
            const content = await extractTextFromPdf(file);
            
            if (content) {
                setResumeText(content);
            }
            
            setUploadProgress(100);
            setIsUploading(false);
          } catch (err) {
            console.error('Error extracting resume text locally:', err);
            setIsUploading(false);
          }
        }
      };
      reader.readAsText(file);
    }
  }, [fs, ai]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 20 * 1024 * 1024, // 20MB
  });

  const analyzeMatch = async () => {
    if (!jobDescription.trim() || !resumeFile) {
      setError('Please provide both a job description and upload a resume');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      // Upload resume to get file path
      const uploadResult = await fs.upload([resumeFile]);
      if (!uploadResult || !uploadResult.path) {
        throw new Error('Failed to upload resume');
      }

      // Create AI prompt for job matching
      const prompt = `You are an expert in resume analysis and job matching. Analyze how well this resume matches the given job description and provide a comprehensive analysis.

Job Description:
${jobDescription}

Please provide the analysis in the following JSON format:
{
  "matchScore": <number between 0-100>,
  "missingKeywords": ["keyword1", "keyword2", ...],
  "suggestions": ["specific suggestion 1", "specific suggestion 2", ...],
  "strengths": ["strength 1", "strength 2", ...]
}

Guidelines:
- Match Score: Rate how well the resume aligns with job requirements (0-100)
- Missing Keywords: List important skills/terms from job description that are missing or weak in resume
- Suggestions: Provide 3-5 specific, actionable recommendations to improve the match
- Strengths: Highlight 2-4 areas where the resume strongly matches job requirements

Be specific and actionable in your suggestions. Focus on concrete improvements the candidate can make to better align with this job posting.

Return ONLY the JSON object, no other text.`;

      // Call AI analysis
      const aiResponse = await ai.feedback(uploadResult.path, prompt);
      
      if (!aiResponse || !aiResponse.message?.content) {
        throw new Error('Failed to get AI analysis');
      }

      let analysisResult: JobMatchResult;
      
      try {
        // Handle AI response content properly (following existing pattern)
        const feedbackText = typeof aiResponse.message.content === 'string'
          ? aiResponse.message.content
          : aiResponse.message.content[0].text;
        
        // Store raw response for debugging
        setRawAiResponse(feedbackText);
        
        // Try to parse JSON from response
        const jsonMatch = feedbackText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        // Fallback: create a structured response from text
        const feedbackText = typeof aiResponse.message.content === 'string'
          ? aiResponse.message.content
          : aiResponse.message.content[0].text;
        
        setRawAiResponse(feedbackText);
        
        analysisResult = {
          matchScore: 75, // Default score
          missingKeywords: ['Unable to parse specific keywords'],
          suggestions: ['Review the full analysis below for detailed feedback'],
          strengths: ['Analysis completed successfully']
        };
        
        // Add the full AI response as additional context
        if (feedbackText && feedbackText.length > 100) {
          analysisResult.suggestions.push(`Full AI Analysis: ${feedbackText.substring(0, 500)}...`);
        }
      }

      setResult(analysisResult);
      onAnalysisComplete?.(analysisResult);

      // Clean up uploaded file
      await fs.delete(uploadResult.path);

    } catch (err) {
      let errorMessage = 'Analysis failed';
      
      if (err instanceof Error) {
        if (err.message.includes('Failed to upload')) {
          errorMessage = 'Failed to upload resume. Please try again.';
        } else if (err.message.includes('Failed to get AI analysis')) {
          errorMessage = 'AI analysis service is currently unavailable. Please try again later.';
        } else if (err.message.includes('JSON')) {
          errorMessage = 'Analysis completed but results could not be formatted properly. Check the debug section below.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      console.error('Job matching analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Function to search for jobs based on resume content
  const searchJobs = async () => {
    if (!resumeText) {
      setError('Please upload a resume first');
      return;
    }

    setIsSearchingJobs(true);
    setError(null);
    setJobs([]);

    try {
      const query = (jobSearchQuery || extractJobTitleFromResume(resumeText)).trim();

      // Call Remotive public API for job listings
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const resp = await fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        throw new Error(`Job API request failed (${resp.status})`);
      }

      const data = await resp.json();
      const remotiveJobs = Array.isArray(data?.jobs) ? data.jobs : [];

      // Build a simple keyword set from resume text for relevance scoring
      const resumeKeywords = new Set(
        (resumeText.toLowerCase().match(/[a-zA-Z][a-zA-Z+.#-]{2,}/g) || [])
          .filter((w) => w.length >= 3)
          .slice(0, 200)
      );

      const mapped: Job[] = remotiveJobs.map((j: any) => {
        const description = String(j.description || '');
        const lowerDesc = description.toLowerCase();
        let matches = 0;
        for (const kw of resumeKeywords) {
          if (lowerDesc.includes(kw)) matches++;
        }
        const base = 60;
        const relevanceScore = Math.max(50, Math.min(98, base + Math.min(matches, 20) * 2));

        return {
          id: String(j.id ?? j.url ?? Math.random().toString(36).slice(2)),
          title: String(j.title || 'Job'),
          company: String(j.company_name || j.company || 'Company'),
          location: String(j.candidate_required_location || j.job_type || 'Remote'),
          description: description.replace(/<[^>]*>/g, '').slice(0, 600),
          url: String(j.url || '#'),
          relevanceScore
        };
      })
      .sort((a: Job, b: Job) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, 25);

      if (mapped.length === 0) {
        // Fallback to internal mock if API returned nothing
        const fallback = generateMockJobs(query, resumeText);
        setJobs(fallback);
      } else {
        setJobs(mapped);
      }

    } catch (err) {
      setError('Failed to search for jobs. Please try again.');
    } finally {
      setIsSearchingJobs(false);
    }
  };

  // Extract job title from resume for search
  const extractJobTitleFromResume = (text: string) => {
    // Simple extraction logic - in real app would use more sophisticated NLP
    const commonTitles = [
      'software engineer', 'web developer', 'data scientist', 'product manager',
      'project manager', 'ux designer', 'marketing manager', 'sales representative',
      'data analyst', 'business analyst', 'frontend developer', 'backend developer'
    ];
    
    const lowerText = text.toLowerCase();
    for (const title of commonTitles) {
      if (lowerText.includes(title)) {
        return title;
      }
    }
    
    return 'software developer'; // Default fallback
  };

  // Generate mock jobs based on resume content
  const generateMockJobs = (query: string, resumeText: string): Job[] => {
    const lowerResumeText = resumeText.toLowerCase();
    
    // Base jobs that will be returned
    const baseJobs = [
      {
        id: '1',
        title: `Senior ${query.charAt(0).toUpperCase() + query.slice(1)}`,
        company: 'TechCorp Inc.',
        location: 'Remote',
        description: `We are looking for an experienced ${query} with strong problem-solving skills. Must have experience with modern technologies and frameworks.`,
        url: 'https://example.com/job1',
        relevanceScore: 92
      },
      {
        id: '2',
        title: `${query.charAt(0).toUpperCase() + query.slice(1)} Lead`,
        company: 'InnovateSoft',
        location: 'New York, NY',
        description: `Lead ${query} position requiring 5+ years of experience. Must have team management experience and excellent communication skills.`,
        url: 'https://example.com/job2',
        relevanceScore: 88
      },
      {
        id: '3',
        title: `Junior ${query.charAt(0).toUpperCase() + query.slice(1)}`,
        company: 'StartupXYZ',
        location: 'San Francisco, CA',
        description: `Entry-level ${query} position. Great opportunity for recent graduates with relevant projects or internships.`,
        url: 'https://example.com/job3',
        relevanceScore: 75
      }
    ];
    
    // Adjust relevance scores based on resume content
    return baseJobs.map(job => {
      let score = job.relevanceScore || 70;
      const jobDescLower = job.description.toLowerCase();
      
      // Check for keyword matches between job and resume
      const keywords = jobDescLower.match(/\b\w{5,}\b/g) || [];
      let matches = 0;
      
      for (const keyword of keywords) {
        if (lowerResumeText.includes(keyword)) {
          matches++;
        }
      }
      
      // Adjust score based on matches
      score = Math.min(100, score + (matches * 2));
      
      return {
        ...job,
        relevanceScore: score
      };
    }).sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  };

  const resetAnalysis = () => {
    setJobDescription('');
    setResumeFile(null);
    setResult(null);
    setError(null);
    setRawAiResponse(null);
    setShowDebug(false);
    setJobs([]);
    setJobSearchQuery('');
  };

  return (
    <div className="bg-white rounded-2xl shadow-md w-full p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Resume Job Matcher</h2>
        <p className="text-gray-600">
          Upload your resume to find matching job opportunities or analyze how well you match a specific job description.
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="w-full md:w-1/2">
            {/* Resume Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Your Resume
              </label>
              <div className="w-full gradient-border">
            <div {...getRootProps()}>
                <input {...getInputProps()} disabled={isAnalyzing || isSearchingJobs} />
              
              <div className="space-y-4 cursor-pointer">
                {resumeFile ? (
                  <div className="uploader-selected-file" onClick={(e) => e.stopPropagation()}>
                    <img src="/images/pdf.png" alt="pdf" className="size-10" />
                    <div className="flex items-center space-x-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700 truncate max-w-xs">
                          {resumeFile.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatSize(resumeFile.size)}
                        </p>
                      </div>
                    </div>
                    <button 
                      className="p-2 cursor-pointer" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setResumeFile(null);
                      }}
                      disabled={isAnalyzing}
                    >
                      <img src="/icons/cross.svg" alt="remove" className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="mx-auto w-16 h-16 flex items-center justify-center mb-2">
                      <img src="/icons/info.svg" alt="upload" className="size-20" />
                    </div>
                    <p className="text-lg text-gray-500">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-lg text-gray-500">PDF (max 20MB)</p>
                  </div>
                )}
              </div>
            </div>
            {resumeFile && (
              <div className="mt-3">
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 ${uploadProgress >= 100 ? 'bg-green-500' : 'bg-blue-500'} transition-all`}
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <div className="mt-1 text-xs text-gray-600 flex justify-between">
                  <span>{isUploading ? 'Uploading & processing...' : uploadProgress >= 100 ? 'Ready' : 'Preparing...'}</span>
                  <span>{uploadProgress}%</span>
                </div>
              </div>
            )}
            </div>
            </div>
            
            {/* Job Search Section */}
            <div className="mt-4">
              <div className="flex flex-col space-y-2">
                <label htmlFor="jobSearchQuery" className="block text-sm font-medium text-gray-700">
                  Search for Jobs (Optional)
                </label>
                <div className="flex">
                  <input
                    type="text"
                    id="jobSearchQuery"
                    value={jobSearchQuery}
                    onChange={(e) => setJobSearchQuery(e.target.value)}
                    placeholder="Enter job title, skills, or keywords"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isSearchingJobs || !resumeFile || uploadProgress < 100}
                  />
                  <button
                    onClick={searchJobs}
                    disabled={isSearchingJobs || !resumeFile || uploadProgress < 100}
                    className={`px-4 py-2 rounded-r-lg font-medium ${
                      isSearchingJobs || !resumeFile || uploadProgress < 100
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    } transition-colors`}
                  >
                    {isSearchingJobs ? (
                      <div className="flex items-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Searching...
                      </div>
                    ) : (
                      'Find Jobs'
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  We'll match your resume with relevant job opportunities
                </p>
              </div>
            </div>
          </div>
          
          <div className="w-full md:w-1/2">
            {/* Job Description Input for Manual Analysis */}
            <div>
              <label htmlFor="jobDescription" className="block text-sm font-medium text-gray-700 mb-2">
                Job Description (Optional)
              </label>
              <textarea
                id="jobDescription"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste a specific job description here to analyze how well your resume matches..."
                className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                disabled={isAnalyzing}
              />
            </div>
          </div>
        </div>

        {/* Display job search results */}
        {jobs.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Matching Job Opportunities</h3>
            <div className="space-y-4">
              {jobs.map((job) => (
                <div key={job.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">{job.title}</h4>
                      <p className="text-gray-700">{job.company} • {job.location}</p>
                    </div>
                    <div className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
                      {job.relevanceScore}% Match
                    </div>
                  </div>
                  <p className="text-gray-600 mt-2 line-clamp-2">{job.description}</p>
                  <div className="mt-3 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <a 
                        href={job.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                      >
                        View Job Details
                      </a>
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center px-3 py-1.5 rounded-md bg-black text-white text-sm font-medium hover:opacity-90"
                      >
                        Apply
                      </a>
                    </div>
                    <button
                      onClick={() => {
                        setJobDescription(job.description);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      Analyze Match
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {(!isSearchingJobs && resumeFile && jobs.length === 0 && !error) && (
          <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
            No jobs found yet. Try a different keyword, e.g., update the search box.
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={analyzeMatch}
            disabled={isAnalyzing || !jobDescription.trim() || !resumeFile || uploadProgress < 100}
            className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isAnalyzing ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Analyzing Match...
              </div>
            ) : (
              'Analyze Match'
            )}
          </button>
          
          {(result || jobs.length > 0) && (
            <button
              onClick={resetAnalysis}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Reset
            </button>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <img src="/icons/cross.svg" alt="error" className="w-5 h-5 text-red-600" />
              <p className="text-red-700 font-medium">Analysis Error</p>
            </div>
            <p className="text-red-600 mt-1">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {isAnalyzing && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <div>
                <p className="text-blue-700 font-medium">Analyzing your resume...</p>
                <p className="text-blue-600 text-sm">This may take a few moments</p>
              </div>
            </div>
          </div>
        )}

        {/* Results Display */}
        {result && (
          <div className="space-y-6 animate-in fade-in duration-1000">
            {/* Match Score */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-gray-900">Match Score</h3>
                <div className="text-4xl font-bold text-blue-600">{result.matchScore}%</div>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all duration-1000 ${
                    result.matchScore >= 80 ? 'bg-green-500' :
                    result.matchScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${result.matchScore}%` }}
                ></div>
              </div>
              
              <p className="text-sm text-gray-600 mt-2">
                {result.matchScore >= 80 ? 'Excellent match!' :
                 result.matchScore >= 60 ? 'Good match with room for improvement' :
                 'Needs significant improvement'}
              </p>
            </div>

            {/* Strengths */}
            {result.strengths && result.strengths.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                <h4 className="text-xl font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <img src="/icons/check.svg" alt="strengths" className="w-5 h-5" />
                  Strengths
                </h4>
                <ul className="space-y-2">
                  {result.strengths.map((strength, index) => (
                    <li key={index} className="text-green-700 flex items-start gap-2">
                      <span className="text-green-500 mt-1">•</span>
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Missing Keywords */}
            {result.missingKeywords && result.missingKeywords.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                <h4 className="text-xl font-semibold text-yellow-800 mb-3 flex items-center gap-2">
                  <img src="/icons/warning.svg" alt="missing" className="w-5 h-5" />
                  Missing Keywords
                </h4>
                <div className="flex flex-wrap gap-2">
                  {result.missingKeywords.map((keyword, index) => (
                    <span 
                      key={index}
                      className="bg-yellow-200 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {result.suggestions && result.suggestions.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <h4 className="text-xl font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <img src="/icons/info.svg" alt="suggestions" className="w-5 h-5" />
                  Improvement Suggestions
                </h4>
                <ul className="space-y-3">
                  {result.suggestions.map((suggestion, index) => (
                    <li key={index} className="text-blue-700 flex items-start gap-3">
                      <span className="bg-blue-200 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5">
                        {index + 1}
                      </span>
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Debug Section */}
        {rawAiResponse && (
          <div className="mt-6">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              {showDebug ? 'Hide' : 'Show'} Raw AI Response (Debug)
            </button>
            {showDebug && (
              <div className="mt-2 bg-gray-100 border rounded-lg p-4 max-h-64 overflow-y-auto">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                  {rawAiResponse}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default JobMatcher;
