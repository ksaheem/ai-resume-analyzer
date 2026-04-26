
<div align="center">
  <img src="public/screenshots/banner.png" alt="Project Banner" width="100%" />
</div>

# Resume Analyser

An intelligent, AI-powered application designed to evaluate, manage, and score resumes against job descriptions. Built with React, React Router, and Puter.js, this platform provides seamless authentication, secure resume storage, and advanced AI evaluations to deliver tailored ATS (Applicant Tracking System) scores and custom feedback.

## 📸 Screenshots

| Screenshot 1 | Screenshot 2 | Screenshot 3 | Screenshot 4 | 
|---|---|---|---|
| <img src="public/screenshots/Screenshot%202026-04-26%20123032.png" alt="Screenshot 1" /> | <img src="public/screenshots/Screenshot%202026-04-26%20123101.png" alt="Screenshot 2" /> | <img src="public/screenshots/Screenshot%202026-04-26%20123136.png" alt="Screenshot 3" /> | <img src="public/screenshots/Screenshot%202026-04-26%20123231.png" alt="Screenshot 4" /> |

| Screenshot 5 | Screenshot 6 | Screenshot 7 |
|---|---|---|
| <img src="public/screenshots/Screenshot%202026-04-26%20123522.png" alt="Screenshot 5" /> | <img src="public/screenshots/Screenshot%202026-04-26%20123910.png" alt="Screenshot 6" /> | <img src="public/screenshots/Screenshot%202026-04-26%20123950.png" alt="Screenshot 7" /> |


## 🚀 Features

- **Seamless Authentication**: Browser-based authentication powered by Puter.js, requiring no backend setup.
- **Resume Upload & Management**: Drag-and-drop resume uploading utilizing `react-dropzone` and `pdfjs-dist` for PDF parsing. Store and manage all your resumes securely.
- **AI-Powered ATS Matching**: Provide a job description and let the AI analyze your resume, generating an ATS compatibility score and custom, actionable feedback tailored to the specific listing.
- **Modern & Reusable UI**: A clean, responsive interface built with Tailwind CSS, ensuring cross-device compatibility and an excellent user experience.
- **Fast & Lightweight**: Built on top of Vite and React Router 7 for blazing-fast performance. State management is efficiently handled using Zustand.

## 🛠️ Tech Stack

- **Frontend Framework**: [React 19](https://react.dev/)
- **Routing**: [React Router v7](https://reactrouter.com/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vite.dev/)
- **Backend/AI/Auth**: [Puter.js](https://docs.puter.com/) (Serverless platform handling Auth, Storage, and AI functionalities directly from the browser)
- **Utilities**: `react-dropzone` (file uploads), `pdfjs-dist` (PDF extraction)

## 🤸 Quick Start

Follow these steps to set up the project locally on your machine.

### Prerequisites

Ensure you have the following installed:
- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/en) (v20+ recommended)
- [npm](https://www.npmjs.com/) (Node Package Manager)

### Installation Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/ksaheem/ai-resume-analyzer.git
   cd ai-resume-analyzer
   ```

2. **Install Dependencies**
   Install the required project dependencies using npm:
   ```bash
   npm install
   ```

3. **Start the Development Server**
   Run the project locally:
   ```bash
   npm run dev
   ```

4. **Open the Application**
   Open your browser and navigate to [http://localhost:5173](http://localhost:5173) to view the project.

## 📁 Project Structure

Brief overview of the significant directories and files:

- `/app`: Contains the main React application code, components, and pages.
- `/public`: Static assets (images, icons, etc.) that are served directly.
- `/types`: TypeScript type definitions.
- `package.json`: Contains project metadata, scripts, and list of dependencies.
- `vite.config.ts`: Configuration file for the Vite build tool.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](../../issues).

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is open-source and available under the [MIT License](LICENSE).
