import {Link} from "react-router";
import ScoreCircle from "~/components/ScoreCircle";
import {useEffect, useState} from "react";
import {usePuterStore} from "~/lib/puter";

interface ResumeCardProps {
    resume: Resume;
    onDelete?: (id: string) => void;
}

const ResumeCard = ({ resume: { id, companyName, jobTitle, feedback, imagePath }, onDelete }: ResumeCardProps) => {
    const { fs } = usePuterStore();
    const [resumeUrl, setResumeUrl] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const loadResume = async () => {
            const blob = await fs.read(imagePath);
            if(!blob) return;
            let url = URL.createObjectURL(blob);
            setResumeUrl(url);
        }

        loadResume();
    }, [imagePath]);

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!onDelete) {
            console.warn('No onDelete handler provided');
            return;
        }
        
        console.log('Delete button clicked for resume ID:', id);
        setIsDeleting(true);
        
        try {
            await onDelete(id);
            console.log('Delete completed successfully for ID:', id);
        } catch (error) {
            console.error('Failed to delete resume:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="resume-card animate-in fade-in duration-1000 relative group">
            {/* Delete Button */}
            {onDelete && (
                <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="absolute top-2 right-2 z-10 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 disabled:opacity-50"
                    title="Delete resume"
                >
                    {isDeleting ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        <img src="/icons/cross.svg" alt="delete" className="w-4 h-4" />
                    )}
                </button>
            )}
            
            <Link to={`/resume/${id}`} className="block">
                <div className="resume-card-header">
                    <div className="flex flex-col gap-2">
                        {companyName && <h2 className="!text-black font-bold break-words">{companyName}</h2>}
                        {jobTitle && <h3 className="text-lg break-words text-gray-500">{jobTitle}</h3>}
                        {!companyName && !jobTitle && <h2 className="!text-black font-bold">Resume</h2>}
                    </div>
                    <div className="flex-shrink-0">
                        <ScoreCircle score={feedback.overallScore} />
                    </div>
                </div>
                {resumeUrl && (
                    <div className="gradient-border animate-in fade-in duration-1000">
                        <div className="w-full h-full">
                            <img
                                src={resumeUrl}
                                alt="resume"
                                className="w-full h-[350px] max-sm:h-[200px] object-cover object-top"
                            />
                        </div>
                    </div>
                )}
            </Link>
        </div>
    )
}
export default ResumeCard
