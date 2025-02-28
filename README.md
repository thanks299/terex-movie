Terex Movie Website

Terex Movie is a web application built with Next.js that provides an interactive platform to explore and discover movies. It fetches movie data from an external API and presents it in a user-friendly interface.

Features

Browse a collection of popular movies

View detailed information about each movie

Responsive design for desktop and mobile devices

Fast navigation with Next.js static generation

Technologies Used

Frontend: Next.js, React

Styling: Tailwind CSS

API: External movie database API

Getting Started

Prerequisites

Make sure you have the following installed:

Node.js (v18 or later)

npm or yarn

Installation

Clone the repository:

git clone https://github.com/thanks299/terex-movie.git

Navigate to the project directory:

cd terex-movie

Install dependencies:

npm install
# or
yarn install

Development Server

To start the development server:

npm run dev
# or
yarn dev

The site will be available at http://localhost:3000

Build and Deployment

To build the project for production:

npm run build
# or
yarn build

The optimized production build will be generated in the build/ directory.

For deployment on Netlify, ensure the following settings:

Build command: npm run build

Publish directory: out

Environment Variables

Create a .env.local file in the root directory and add:

API_KEY=your_api_key_here
API_URL=https://api.themoviedb.org/3

Contributing

We welcome contributions! Please fork the repository and create a pull request with your changes.

License

This project is licensed under the MIT License.

