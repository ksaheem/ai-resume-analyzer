import {Link} from "react-router";

const Navbar = () => {
    return (
        <nav className="navbar">
            <Link to="/">
                <p className="text-2xl font-bold text-gradient">RESUME ANALYSER</p>
            </Link>
            <div className="flex gap-4">
                <Link to="/career-roadmap" className="primary-button w-fit">
                    Career Roadmap
                </Link>
                <Link to="/job-matcher" className="primary-button w-fit">
                    Job Matcher
                </Link>
                <Link to="/upload" className="primary-button w-fit">
                    Upload Resume
                </Link>
            </div>
        </nav>
    )
}
export default Navbar
