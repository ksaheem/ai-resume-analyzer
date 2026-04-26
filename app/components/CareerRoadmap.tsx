import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { usePuterStore } from '~/lib/puter';
import { formatSize } from '../lib/utils';

interface RoadmapItem {
  skill: string;
  gap: string;
  action: string;
  timeline: string;
  priority: 'high' | 'medium' | 'low';
  resources?: string[];
}

interface CareerRoadmapResult {
  currentSkills: string[];
  missingSkills: string[];
  roadmap: RoadmapItem[];
  estimatedTimeline: string;
  summary: string;
}

interface CareerRoadmapProps {
  onRoadmapComplete?: (result: CareerRoadmapResult) => void;
}

const CareerRoadmap = ({ onRoadmapComplete }: CareerRoadmapProps) => {
  const [targetJob, setTargetJob] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<CareerRoadmapResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawAiResponse, setRawAiResponse] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const { ai, fs } = usePuterStore();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0] || null;
    setResumeFile(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 20 * 1024 * 1024, // 20MB
  });

  const generateRoadmap = async () => {
    if (!targetJob.trim() || !resumeFile) {
      setError('Please provide both a target job title and upload a resume');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      // Check if Puter service is available
      const puter = window.puter;
      if (!puter) {
        throw new Error('AI service not available. Please refresh the page and try again.');
      }

      // Check if user is authenticated
      const isAuthenticated = await puter.auth.isSignedIn();
      if (!isAuthenticated) {
        throw new Error('Please sign in to use the AI service. Click the sign-in button and try again.');
      }

      console.log('Starting roadmap generation...');
      
      // Upload resume to get file path
      console.log('Uploading resume...');
      const uploadResult = await fs.upload([resumeFile]);
      if (!uploadResult || !uploadResult.path) {
        throw new Error('Failed to upload resume');
      }
      console.log('Resume uploaded successfully:', uploadResult.path);

      // Create AI prompt for career roadmap generation
      const prompt = `You are an expert IT career coach and technical recruiter. Analyze this resume and create a comprehensive career roadmap to help the candidate reach their target IT job role.

Target Job Title: ${targetJob}

Please provide a detailed IT career roadmap analysis in the following JSON format:
{
  "currentSkills": ["skill1", "skill2", ...],
  "missingSkills": ["skill1", "skill2", ...],
  "roadmap": [
    {
      "skill": "skill name",
      "gap": "description of the gap",
      "action": "specific actionable step",
      "timeline": "timeframe (e.g., '2-3 months', '6 weeks')",
      "priority": "high/medium/low",
      "resources": ["resource1", "resource2"]
    }
  ],
  "estimatedTimeline": "overall timeline to reach target role",
  "summary": "brief summary of the roadmap and key recommendations"
}

Guidelines for IT roles:
- Current Skills: List all technical skills, programming languages, frameworks, tools, and soft skills found in the resume
- Missing Skills: Identify ALL critical skills needed for the target IT role including:
  * Programming languages (JavaScript, Python, Java, C++, etc.)
  * Frameworks and libraries (React, Angular, Vue, Django, Spring, etc.)
  * Databases (SQL, NoSQL, MongoDB, PostgreSQL, etc.)
  * Cloud platforms (AWS, Azure, GCP)
  * DevOps tools (Docker, Kubernetes, CI/CD)
  * Version control (Git, GitHub, GitLab)
  * Testing frameworks
  * System design and architecture
  * Security fundamentals
  * Soft skills (communication, teamwork, problem-solving)

- Roadmap: Create 8-12 specific, actionable learning steps with realistic timelines
- Priority: Rate each skill gap as high (essential), medium (important), or low (nice-to-have)
- Resources: Suggest specific courses, tutorials, projects, certifications, and learning materials
- Timeline: Be realistic but encouraging (typically 6-18 months depending on role complexity)

For Web Development specifically, ensure coverage of:
- Frontend: HTML, CSS, JavaScript, React/Angular/Vue, responsive design
- Backend: Node.js, Python/Django, databases, APIs, server management
- DevOps: Git, deployment, cloud services, testing
- Tools: VS Code, browser dev tools, package managers, build tools

For other IT roles, focus on role-specific requirements:
- Data Science: Python, R, SQL, machine learning, statistics, visualization
- DevOps: Linux, Docker, Kubernetes, CI/CD, cloud platforms, monitoring
- Cybersecurity: networking, security tools, compliance, risk assessment
- Software Engineering: algorithms, data structures, system design, testing

Return ONLY the JSON object, no other text.`;

      // Call AI analysis
      console.log('Calling AI analysis...');
      const aiResponse = await ai.feedback(uploadResult.path, prompt);
      console.log('AI response received:', aiResponse);
      
      if (!aiResponse || !aiResponse.message?.content) {
        throw new Error('Failed to get AI analysis');
      }

      let roadmapResult: CareerRoadmapResult;
      
      try {
        // Handle AI response content properly
        const feedbackText = typeof aiResponse.message.content === 'string'
          ? aiResponse.message.content
          : aiResponse.message.content[0].text;
        
        // Store raw response for debugging
        setRawAiResponse(feedbackText);
        
        // Try to parse JSON from response
        const jsonMatch = feedbackText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          roadmapResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        // Fallback: create a structured response from text
        const feedbackText = typeof aiResponse.message.content === 'string'
          ? aiResponse.message.content
          : aiResponse.message.content[0].text;
        
        setRawAiResponse(feedbackText);
        
        roadmapResult = {
          currentSkills: ['Analysis completed successfully'],
          missingSkills: ['Please review the full analysis below'],
          roadmap: [{
            skill: 'General Development',
            gap: 'Unable to parse specific roadmap',
            action: 'Review the full AI analysis below',
            timeline: 'Varies',
            priority: 'medium' as const,
            resources: ['See detailed analysis']
          }],
          estimatedTimeline: 'Please review analysis',
          summary: 'Analysis completed - see detailed recommendations below'
        };
        
        // Add the full AI response as additional context
        if (feedbackText && feedbackText.length > 100) {
          roadmapResult.roadmap[0].resources?.push(`Full Analysis: ${feedbackText.substring(0, 500)}...`);
        }
      }

      setResult(roadmapResult);
      onRoadmapComplete?.(roadmapResult);

      // Clean up uploaded file
      await fs.delete(uploadResult.path);

    } catch (err) {
      let errorMessage = 'Roadmap generation failed';
      
      // Enhanced error logging
      console.error('Detailed error information:', {
        error: err,
        errorType: typeof err,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorStack: err instanceof Error ? err.stack : undefined,
        puterAvailable: !!window.puter,
        fsAvailable: !!fs,
        aiAvailable: !!ai
      });
      
      if (err instanceof Error) {
        if (err.message.includes('Failed to upload')) {
          errorMessage = 'Failed to upload resume. Please try again.';
        } else if (err.message.includes('Failed to get AI analysis')) {
          errorMessage = 'AI analysis service is currently unavailable. Please try again later.';
        } else if (err.message.includes('JSON')) {
          errorMessage = 'Analysis completed but results could not be formatted properly. Check the debug section below.';
        } else if (err.message.includes('WebSocket') || err.message.includes('connection')) {
          errorMessage = 'Connection to AI service failed. Please check your internet connection and try again.';
        } else if (err.message.includes('timeout')) {
          errorMessage = 'Request timed out. Please try again with a smaller file.';
        } else if (err.message.includes('network') || err.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your internet connection.';
        } else {
          errorMessage = `Error: ${err.message}`;
        }
      } else {
        // Log the actual error object for debugging
        console.error('Non-Error object caught:', err);
        errorMessage = `Unexpected error: ${JSON.stringify(err)}`;
      }
      
      setError(errorMessage);
      console.error('Career roadmap generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const resetRoadmap = () => {
    setTargetJob('');
    setResumeFile(null);
    setResult(null);
    setError(null);
    setRawAiResponse(null);
    setShowDebug(false);
    setCompletedSteps(new Set());
  };

  const toggleStepCompletion = (stepIndex: number) => {
    setCompletedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepIndex)) {
        newSet.delete(stepIndex);
      } else {
        newSet.add(stepIndex);
      }
      return newSet;
    });
  };

  const copyRoadmap = async () => {
    if (!result) return;
    
    const roadmapText = `
Career Roadmap for: ${targetJob}

Current Skills: ${result.currentSkills.join(', ')}

Missing Skills: ${result.missingSkills.join(', ')}

Estimated Timeline: ${result.estimatedTimeline}

ROADMAP:
${result.roadmap.map((item, index) => `
${index + 1}. ${item.skill} (${item.priority.toUpperCase()} priority)
   Gap: ${item.gap}
   Action: ${item.action}
   Timeline: ${item.timeline}
   Resources: ${item.resources?.join(', ') || 'N/A'}
`).join('')}

Summary: ${result.summary}
    `.trim();

    try {
      await navigator.clipboard.writeText(roadmapText);
      alert('Roadmap copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      alert('Failed to copy roadmap. Please try again.');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 border-red-200 text-red-800';
      case 'medium': return 'bg-yellow-100 border-yellow-200 text-yellow-800';
      case 'low': return 'bg-green-100 border-green-200 text-green-800';
      default: return 'bg-gray-100 border-gray-200 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-md w-full p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Career Roadmap Generator</h2>
        <p className="text-gray-600">
          Upload your resume and specify your target job to get a personalized roadmap with skill gaps, learning resources, and timeline.
        </p>
      </div>

      <div className="space-y-6">
        {/* Target Job Input */}
        <div>
          <label htmlFor="targetJob" className="block text-sm font-medium text-gray-700 mb-2">
            Target Job Title
          </label>
          <input
            id="targetJob"
            type="text"
            value={targetJob}
            onChange={(e) => setTargetJob(e.target.value)}
            placeholder="e.g., Senior Software Engineer, Data Scientist, Product Manager..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isGenerating}
          />
        </div>

        {/* Resume Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Resume Upload
          </label>
          <div className="w-full gradient-border">
            <div {...getRootProps()}>
              <input {...getInputProps()} disabled={isGenerating} />
              
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
                      disabled={isGenerating}
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
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={generateRoadmap}
            disabled={isGenerating || !targetJob.trim() || !resumeFile}
            className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Generating Roadmap...
              </div>
            ) : (
              'Generate Roadmap'
            )}
          </button>
          
          {result && (
            <button
              onClick={resetRoadmap}
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
              <p className="text-red-700 font-medium">Generation Error</p>
            </div>
            <p className="text-red-600 mt-1">{error}</p>
            {error.includes('Connection') || error.includes('service') ? (
              <div className="mt-3">
                <button
                  onClick={() => {
                    setError(null);
                    window.location.reload();
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Refresh Page & Try Again
                </button>
                <p className="text-xs text-gray-600 mt-2">
                  If the problem persists, try refreshing the page or check your internet connection.
                </p>
              </div>
            ) : null}
          </div>
        )}

        {/* Loading State */}
        {isGenerating && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
              <div>
                <p className="text-purple-700 font-medium">Analyzing your career path...</p>
                <p className="text-purple-600 text-sm">This may take a few moments</p>
              </div>
            </div>
          </div>
        )}

        {/* Results Display */}
        {result && (
          <div className="space-y-6 animate-in fade-in duration-1000">
            {/* Copy Button and Progress */}
            <div className="flex justify-between items-center">
              <div className="flex-1 mr-4">
                <div className="text-sm text-gray-600 mb-1">Overall Progress</div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(completedSteps.size / result.roadmap.length) * 100}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {completedSteps.size} of {result.roadmap.length} steps completed
                </div>
              </div>
              <button
                onClick={copyRoadmap}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Roadmap
              </button>
            </div>

            {/* Summary */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">IT Career Roadmap Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Current Skills ({result.currentSkills.length})
                  </h4>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {result.currentSkills.map((skill, index) => (
                      <span key={index} className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    Skills to Learn ({result.missingSkills.length})
                  </h4>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {result.missingSkills.map((skill, index) => (
                      <span key={index} className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-white rounded-lg p-4 border border-purple-200">
                  <h4 className="font-semibold text-gray-700 mb-2">Estimated Timeline</h4>
                  <p className="text-lg text-purple-600 font-medium">{result.estimatedTimeline}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-purple-200">
                  <h4 className="font-semibold text-gray-700 mb-2">Learning Path</h4>
                  <p className="text-sm text-gray-600">{result.roadmap.length} structured steps to reach your goal</p>
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <h4 className="font-semibold text-gray-700 mb-2">Career Strategy</h4>
                <p className="text-gray-600">{result.summary}</p>
              </div>
            </div>

            {/* Roadmap Steps */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-900">Comprehensive IT Learning Path</h3>
                <div className="text-sm text-gray-600">
                  Progress: {completedSteps.size}/{result.roadmap.length} steps completed
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-blue-800 mb-2">Learning Strategy</h4>
                <p className="text-blue-700 text-sm">
                  Follow this structured path to build all required skills for your target IT role. 
                  Each step includes specific resources, projects, and realistic timelines.
                </p>
              </div>
              {result.roadmap.map((item, index) => (
                <div key={index} className={`bg-white border rounded-lg p-6 shadow-sm transition-all duration-200 ${
                  completedSteps.has(index) 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-gray-200 hover:border-purple-200'
                }`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <button
                          onClick={() => toggleStepCompletion(index)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                            completedSteps.has(index)
                              ? 'bg-green-500 text-white'
                              : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                          }`}
                        >
                          {completedSteps.has(index) ? '✓' : index + 1}
                        </button>
                        <h4 className={`text-xl font-semibold ${
                          completedSteps.has(index) ? 'text-green-700 line-through' : 'text-gray-900'
                        }`}>
                          {item.skill}
                        </h4>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(item.priority)}`}>
                          {item.priority.toUpperCase()} PRIORITY
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-medium text-gray-700 mb-1">Gap Analysis</h5>
                          <p className="text-gray-600 text-sm">{item.gap}</p>
                        </div>
                        <div>
                          <h5 className="font-medium text-gray-700 mb-1">Timeline</h5>
                          <p className="text-gray-600 text-sm">{item.timeline}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <h5 className="font-medium text-gray-700 mb-2">Action Plan</h5>
                    <p className="text-gray-600">{item.action}</p>
                  </div>
                  
                  {item.resources && item.resources.length > 0 && (
                    <div>
                      <h5 className="font-medium text-gray-700 mb-2">Recommended Resources</h5>
                      <ul className="list-disc list-inside space-y-1">
                        {item.resources.map((resource, resourceIndex) => (
                          <li key={resourceIndex} className="text-gray-600 text-sm">{resource}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
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
};

export default CareerRoadmap;
