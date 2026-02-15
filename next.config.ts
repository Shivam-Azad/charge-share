/** @type {import('next').NextConfig} */
const isGithubActions = process.env.GITHUB_ACTIONS === 'true';

const nextConfig = {
  // Required for GitHub Pages
  output: 'export',
  
 
  basePath:  '/charge-share'  ,
  assetPrefix:'/charge-share/' ,

  images: {
    unoptimized: true, 
  },
};

export default nextConfig;