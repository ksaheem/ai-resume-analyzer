import type { Route } from "./+types/home";
import Navbar from "~/components/Navbar";
import ResumeCard from "~/components/ResumeCard";
import {usePuterStore} from "~/lib/puter";
import {Link, useNavigate} from "react-router";
import {useEffect, useState} from "react";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Resume Analyser" },
    { name: "description", content: "Smart feedback for your dream job!" },
  ];
}

export default function Home() {
  const { auth, kv, fs } = usePuterStore();
  const navigate = useNavigate();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loadingResumes, setLoadingResumes] = useState(false);

  useEffect(() => {
    if(!auth.isAuthenticated) navigate('/auth?next=/');
  }, [auth.isAuthenticated])

  useEffect(() => {
    const loadResumes = async () => {
      setLoadingResumes(true);

      const resumes = (await kv.list('resume:*', true)) as KVItem[];

      const parsedResumes = resumes?.map((resume) => (
          JSON.parse(resume.value) as Resume
      ))

      setResumes(parsedResumes || []);
      setLoadingResumes(false);
    }

    loadResumes()
  }, []);

  const handleDeleteResume = async (resumeId: string) => {
    // Show confirmation dialog
    const confirmed = window.confirm('Are you sure you want to delete this resume? This action cannot be undone.');
    if (!confirmed) return;

    try {
      // Get the resume data to access file paths
      const resumeData = await kv.get(`resume:${resumeId}`);
      if (!resumeData) {
        console.error('No resume data found for ID:', resumeId);
        alert('Resume not found.');
        return;
      }

      const resume = JSON.parse(resumeData);
      console.log('Deleting resume:', resume);
      
      // Delete files from storage (with error handling)
      let fileDeleteErrors = [];
      
      if (resume.resumePath) {
        try {
          await fs.delete(resume.resumePath);
          console.log('Deleted resume file:', resume.resumePath);
        } catch (fileError) {
          console.warn('Failed to delete resume file:', fileError);
          fileDeleteErrors.push(`Resume file: ${fileError}`);
        }
      }
      
      if (resume.imagePath) {
        try {
          await fs.delete(resume.imagePath);
          console.log('Deleted image file:', resume.imagePath);
        } catch (fileError) {
          console.warn('Failed to delete image file:', fileError);
          fileDeleteErrors.push(`Image file: ${fileError}`);
        }
      }
      
      // Delete from KV store (this is the most important part)
      try {
        await kv.delete(`resume:${resumeId}`);
        console.log('Deleted from KV store:', resumeId);
      } catch (kvError) {
        console.error('Failed to delete from KV store:', kvError);
        throw new Error(`Failed to remove resume from database: ${kvError}`);
      }
      
      // Update local state
      setResumes(prevResumes => prevResumes.filter(r => r.id !== resumeId));
      console.log('Updated local state');
      
      // Show success message even if some files couldn't be deleted
      if (fileDeleteErrors.length > 0) {
        alert(`Resume deleted successfully, but some files couldn't be removed: ${fileDeleteErrors.join(', ')}`);
      }
      
    } catch (error) {
      console.error('Failed to delete resume:', error);
      
      // Fallback: Try to at least remove from database and UI
      try {
        await kv.delete(`resume:${resumeId}`);
        setResumes(prevResumes => prevResumes.filter(r => r.id !== resumeId));
        alert('Resume removed from your list (some files may still exist in storage).');
      } catch (fallbackError) {
        console.error('Fallback delete also failed:', fallbackError);
        alert(`Failed to delete resume completely: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  const handleClearAllResumes = async () => {
    if (resumes.length === 0) return;
    
    // Show confirmation dialog
    const confirmed = window.confirm(`Are you sure you want to delete all ${resumes.length} resume(s)? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      // Use the wipe functionality as a more reliable method
      await kv.flush();
      setResumes([]);
      alert('All resumes deleted successfully.');
      
    } catch (error) {
      console.error('Failed to clear all resumes:', error);
      alert(`Failed to clear all resumes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return <main className="bg-[url('/images/bg-main.svg')] bg-cover">
    <Navbar />

    <section className="main-section">
      <div className="page-heading py-16">
        <h1>Track Your Applications & Resume Ratings</h1>
        {!loadingResumes && resumes?.length === 0 ? (
            <h2>No resumes found. Upload your first resume to get feedback.</h2>
        ): (
          <h2>Review your submissions and check AI-powered feedback.</h2>
        )}
      </div>
      {loadingResumes && (
          <div className="flex flex-col items-center justify-center">
            <img src="/images/resume-scan-2.gif" className="w-[200px]" />
          </div>
      )}

      {!loadingResumes && resumes.length > 0 && (
        <div className="flex flex-col items-center gap-4">
          {/* Clear All Button */}
          <button
            onClick={handleClearAllResumes}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Clear All Resumes
          </button>
          
          <div className="resumes-section">
            {resumes.map((resume) => (
                <ResumeCard key={resume.id} resume={resume} onDelete={handleDeleteResume} />
            ))}
          </div>
        </div>
      )}

      {!loadingResumes && resumes?.length === 0 && (
          <div className="flex flex-col items-center justify-center mt-10 gap-4">
            <Link to="/upload" className="primary-button w-fit text-xl font-semibold">
              Upload Resume
            </Link>
          </div>
      )}

      {/* Feature Cards */}
      <div className="flex justify-center mt-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
          {/* Career Roadmap Feature Card */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Career Roadmap</h3>
              <p className="text-gray-600 mb-6">
                Get a personalized roadmap with skill gaps, learning resources, and timeline to reach your target role.
              </p>
              <Link 
                to="/career-roadmap" 
                className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors inline-block"
              >
                Generate Roadmap
              </Link>
            </div>
          </div>

          {/* Job Matcher Feature Card */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Job Matcher</h3>
              <p className="text-gray-600 mb-6">
                Upload your resume and paste a job description to see how well you match and get AI-powered improvement suggestions.
              </p>
              <Link 
                to="/job-matcher" 
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-block"
              >
                Try Job Matcher
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
}
