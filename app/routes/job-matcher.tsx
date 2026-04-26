import { Link } from "react-router";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { usePuterStore } from "~/lib/puter";
import JobMatcher from "~/components/JobMatcher";

export const meta = () => ([
    { title: 'Resume Analyser | Job Matcher' },
    { name: 'description', content: 'Match your resume with job descriptions using AI' },
])

const JobMatcherPage = () => {
    const { auth, isLoading } = usePuterStore();
    const navigate = useNavigate();

    useEffect(() => {
        if (!isLoading && !auth.isAuthenticated) {
            navigate(`/auth?next=/job-matcher`);
        }
    }, [isLoading, auth.isAuthenticated, navigate]);

    if (isLoading) {
        return (
            <main className="!pt-0">
                <div className="flex items-center justify-center h-screen">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            </main>
        );
    }

    if (!auth.isAuthenticated) {
        return null;
    }

    return (
        <main className="!pt-0">
            {/* Navigation */}
            <nav className="resume-nav">
                <Link to="/" className="back-button">
                    <img src="/icons/back.svg" alt="back" className="w-2.5 h-2.5" />
                    <span className="text-gray-800 text-sm font-semibold">Back to Homepage</span>
                </Link>
            </nav>

            {/* Main Content */}
            <div className="min-h-screen bg-[url('/images/bg-main.svg')] bg-cover bg-center">
                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-4xl mx-auto">
                        <div className="text-center mb-8">
                            <h1 className="text-4xl font-bold text-white mb-4">
                                Job Description Matcher
                            </h1>
                            <p className="text-xl text-gray-200 max-w-2xl mx-auto">
                                Upload your resume and paste a job description to see how well you match and get AI-powered improvement suggestions.
                            </p>
                        </div>

                        <JobMatcher />
                    </div>
                </div>
            </div>
        </main>
    );
};

export default JobMatcherPage;

